const ffmpeg = require('fluent-ffmpeg');
const mp3Duration = require('mp3-duration');
const FileStream = require('fs-extra');
const jsmediatags = require("jsmediatags");
const { Canvas } = require('canvas');

const PATH = `${'MP3S_FOLDER_PATH'}`;
const FONT = `${'FONTS_PATH'}/UbuntuMono-Regular.ttf:fontsize=60`;
process.env.PATH += ";C:/ffmpeg/bin"; //Your ffmpeg binaries path, appended to the system. Comment this if you already have them in your system
var frameNumber = 1; //Number of frames to render
var currentDuration = 0;

(async function () {
    //Read all MP3's from the folder
    const mp3s = FileStream.readdirSync(PATH);
    const size = mp3s.length;

    for (let i = 0; i < size; i++) {
        const MP3 = mp3s[i];
        const tag = await readSong(`${PATH}/${MP3}`);
        var info = `Filename: ${MP3.replace('.mp3', '')} [MP3]\nMETADATA TAGS FOUND\n-------------------\naudio_year_rendered::${tag.tags.year}; encoded_by::${tag.tags.TENC.data}; TBPM::${tag.tags.TBPM.data} beats per minute`;
        currentDuration = await getDuration(`${PATH}/${MP3}`);
        //Render the video with the generated frame... You may modify these functions to render N frames
        await renderVideo(`${PATH}/${MP3}`, info, `${PATH}/${MP3.replace('.mp3', '.mp4')}`);
    }
})();

/**
 * Given an MP3 file path will return it's duration in seconds
 * @param {String} file 
 * @returns The MP3 file duration in seconds
 */
async function getDuration(file) {
    return await (function* () {
        yield new Promise((resolve, reject) => {
            mp3Duration(file, function (err, duration) {
                if (err) return console.log(err.message);
                resolve(duration)
            });
        });
    })().next().value;
}

/**
 * Given an MP3 file path will return all the audio metadata tags
 * @param {String} file 
 * @returns An object with all the audio metadata tags
 */
async function readSong(file) {
    return await (function* () {
        yield new Promise((resolve, reject) => {
            jsmediatags.read(file, {
                onSuccess: function (tag) {
                    resolve(tag)
                },
                onError: function (error) {
                    reject(error)
                }
            });
        });
    })().next().value;
}

/**
 * Generates a frame for the video
 * @param {String} text 
 * @param {String} color 
 * @param {String} backgroundColor 
 * @returns The generated PNG frame path
 */
async function generateBackground(text, color, backgroundColor) {
    const cv = new Canvas(1920, 1080);
    const ct = cv.getContext('2d');

    var w = cv.width;
    var h = cv.height;

    var metrics = ct.measureText(text);
    var fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
    var actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    var textWidth = metrics.width

    ct.fillStyle = 'rgba(0, 0, 0, 255)'; //May use the color variable
    ct.fillRect(0, 0, w, h);
    ct.font = "24px Segoe UI"; //May use the font variable
    ct.fillStyle = "white"; //May use the backgroundColor variable
    ct.textAlign = "center";
    ct.fillText(text, textWidth + 85, h - (actualHeight + 80));
    ct.fill();

    const output = cv.toBuffer('image/png');
    const fileName = process.cwd() + `\\tmp\\output\\frame-${frameNumber++}.png`;
    await FileStream.promises.writeFile(fileName, output);

    return fileName;
}

/**
 * Render a video with a background audio, some text in the background frame and generates the .MP4 file output
 * @param {String} sourceAudio 
 * @param {String} text 
 * @param {String} outputFile 
 * @returns The awaitable promise on render
 */
async function renderVideo(sourceAudio, text, outputFile) {

    const frame = await generateBackground(text);
    const frameRate = 60;

    return await (function* () {
        yield new Promise((resolve, reject) => {
            ffmpeg()
                .input(frame)
                .loop(Math.ceil(currentDuration))
                .inputOptions([
                    // Set input frame rate
                    `-framerate ${frameRate}`,
                ])
                .input(sourceAudio)
                // Add the soundtrack
                /*.audioFilters([
                    // Fade out the volume 2 seconds before the end
                    `afade=out:st=${duration - 2}:d=2`,
                ])*/
                .videoCodec('libx264')
                .outputOptions([
                    // YUV color space with 4:2:0 chroma subsampling for maximum compatibility with
                    // video players
                    '-pix_fmt yuv420p',
                ])
                .audioCodec('aac')
                .size('1920x1080')
                .audioBitrate('192k')
                //.format('yuv420p')
                // Set output frame rate
                .fps(frameRate)
                //.outputOptions('-shortest')
                .saveToFile(outputFile)
                .on('end', () => {
                    resolve(true);
                });
        });
    })().next().value;
}