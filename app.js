const puppeteer = require('puppeteer');
var fs = require('fs');
var request = require('request');
var path = require('path');
var replaceString = require('replace-string');
var sqlite3 = require('sqlite3').verbose();

console.log("start web scrapping");
const home_url = "http://platesmania.com";
const db = new sqlite3.Database('./plates.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Connected to the plate SQlite database.');
});
async function run(){
    const browser = await puppeteer.launch();
    const page = await browser.newPage()
    await page.goto(home_url);
    console.log("Get all country urls from page"); 
    let countries = await page.evaluate(() => {     
        let country_code = new Array();   
        for(var i=2; i<=5; i++){
            const selectors = document.querySelectorAll('div.wrapper > div.header > div:nth-child(4) > div > ul > li:nth-child(1) > ul >li:nth-child('+i+') > ul > li');
            const countries = selectors.length;    
            for(var j = 1; j<=countries; j++){
                const sub_selectors = document.querySelectorAll('div.wrapper > div.header > div:nth-child(4) > div > ul > li:nth-child(1) > ul > li:nth-child('+i+') > ul > li:nth-child('+j+') > a'); 
                sub_selectors.forEach((item) => {
                    country_code.push(item.getAttribute('href') + 'gallery');
                });
            }
        }
       return country_code;
    });
    // await MovePage(home_url + countries[0], page);
    for(i=0; i<countries.length; i++){
        await MovePage(home_url + countries[i], page);
    }    
    
}

async function MovePage( url, page){
    console.log(url);
    await page.goto(url);
    var nextflag = true;
    let carpage = await page.evaluate(() => {
        const selectors = document.querySelectorAll('div.panel-body');
        const car_count = selectors.length;
        if(car_count < 10){
            nextflag = false;
        }
        var cars = new Array();
        selectors.forEach(car => {       
            let imgSelector = car.querySelector('div:nth-child(1) > a >img');
            var mainImageUrl = imgSelector.getAttribute('src');

            let typeSelector = car.querySelector('h4 > a');
            var carType = typeSelector.getAttribute('innerHTML');
            
            var markSelector = car.querySelector('div:nth-child(2) > div > a > img');
            var markImageUrl = markSelector.getAttribute('src');

            cars.push({'mainImageUrl': mainImageUrl, 'carType': carType, 'markImageUrl': markImageUrl});
            
        });
        return cars;
    });
    // console.log(carpage);
    for(var i=0; i<carpage.length; i++){
        var imgUrl = carpage[i].mainImageUrl;
        imgUrl = replaceString(imgUrl, '/m/','/o/');
        db.serialize(function() {  
            db.run("INSERT into plates VALUES ('" + path.basename(carpage[i].mainImageUrl) + "','" + imgUrl + "','" + carpage[i].carType + "','" + carpage[i].markImageUrl + "','" + path.basename(carpage[i].markImageUrl) + "')");  
        });
        await download(imgUrl, 'imgs/' + path.basename(carpage[i].mainImageUrl), function(){
            console.log('done');
        });
    }
    
    let nextpage = await page.evaluate(() => {
        const selectors = document.querySelector('ul.pagination > li:nth-child(12) > a');
        return selectors.getAttribute('href');
    });
    if(nextflag ){
        var nextPageUrl = new URL(url+ ".tmp");
        nextPageUrl.href = replaceString(nextPageUrl.href, path.basename(url+ ".tmp"), nextpage);
        console.log(nextPageUrl.href);
        await MovePage(nextPageUrl.href, page);
    }
    
    // if(nextpage != null ){
    //     MovePage(nextPageUrl, page);
    // }
        
    return true;
}



async function download(uri, filename, callback){
    request.head(uri, function(err, res, body){
        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};


run();