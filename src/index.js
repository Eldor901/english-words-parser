const cheerio = require('cheerio');
const request = require('request');
const util = require('util');
const keys  = require('./keys ');
const mongoUri = keys.mongoURI;
require('./models/WordPage');
const mongoose = require('mongoose');
const WordPage = mongoose.model('WordPage');



const getHtmlContent = (URL) => {
    return new Promise((resolve,  reject) => {
        request(URL, (error, response, html) => {
            if (!error && response.statusCode === 200) {
                resolve(html)
            } else {
                reject(error);
            }
        });
    })
};

const subLinksParse = async (URL) => {
    let html =  await getHtmlContent(URL);
    const $ = cheerio.load(html);

    let elem = $('.dictlink > .ldoceEntry').first();
    let singPost = $(elem).find('.HYPHENATION').first().text();
    let def = $(elem).find('.DEF').first().text();

    let sence = $(elem).find('.Sense').first();

    let phrases = [];
    $(sence).find('.EXAMPLE').each((k, elem) => {
        let  text = $(elem).text().trim();
        let audio = $(elem).find('span').attr('data-src-mp3');
        phrases.push({text, audio})
    });

    if(singPost !=='' || def !=='')
        return {singPost, def, phrases};
    else
        return -1;
};



async function ParsePage(searchWord){
    console.log("Started parsing");

    const  baseURL  = 'https://www.ldoceonline.com';
    const url = '/dictionary/'+searchWord;
    const page = [];
    let  html = "";
    try {
      html = await getHtmlContent(baseURL+url);
    }catch (e) {
        console.log(e);
    }

    const $ = cheerio.load(html);
    const word = $('.dictlink > .ldoceEntry > .frequent ').children().first().text();

    let links = [];
    $('.dictlink > .ldoceEntry > .frequent > span').each((i, el)=>{
        const link = $(el).attr('data-src-mp3');
        if(link)
        {
            if(!links.includes(link))
                links.push(link);
        }
    });

    let defs = [];
    let hrefWatch = [];
    $('.dictlink > .ldoceEntry > .Sense').each((i, el)=>{

        const signPost = $(el).find('.SIGNPOST').text();
        const gram = $(el).find('.GRAM').text();
        const def = $(el).find('.DEF').text();

        let phrases = [];
        $(el).find('.EXAMPLE').each((k, elem) => {
            const examples = $(elem).text().trim();
            const audios = ($(elem).find('span').attr('data-src-mp3'));
            phrases.push({examples, audios});
        });

        let morePhrases = [];
        $(el).find('.crossRef').each(async (k, elem) => {
            let link = $(elem).attr('href');
            hrefWatch.push(link);
        });

        if (signPost !== '' || gram !== '' || def !== '')
        {
            defs.push({signPost, gram, def, phrases});
        }
    });

    let morePhrases = [];
    for(let link in hrefWatch)
    {
        let phrase = await subLinksParse(baseURL+hrefWatch[link]);
        morePhrases.push(phrase);
    }

    return {word, links, definitions: defs, morePhrases};
}

const addDashBeetweenWords = (word) =>
{
    return word.replace(' ', '-');
};

const mongooseConnection = async ()=>{
   await mongoose.connect(mongoUri,{
        useNewUrlParser: true,
        useCreateIndex: true,
    });

   await mongoose.connection.on('connected', ()=>{
        console.log("connected to mongo db");
        return false;
    });

   await mongoose.connection.on('error', (err)=>{
        console.log("error");
    });
};

async function Main() {
    try {
        await mongooseConnection();
    }catch (e) {
        console.log(e);
    }

    let pages = [];

    let fs = require('fs');
    let array = fs.readFileSync('files/oxfordDic.txt').toString().split("\n");


    for(let i in array) {
        if(array[i]) {
            let page = await ParsePage(addDashBeetweenWords(array[i]).trim());
            const wordPage = new WordPage({word: array[i].trim(), wordPage: page});
            try {
                await wordPage.save();
            }
            catch (e) {
                console.log("ooops eroor saving database");
                console.log(e);
            }
        }
    }



//    const wordPage = new WordPage({wordPage: page});
//    await wordPage.save();

//     console.log(util.inspect(pages, false, null, true /* enable colors */))

console.log("save Successfully");
}

Main();
