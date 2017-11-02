/*-----------------------------------------------------------------------------
This script uploads all the small talk utterances to a single small talk intent 
in LUIS. When a user's utterance falls into the small talk intent, it should go
to the QnA maker to obtain a response. 
-----------------------------------------------------------------------------*/

// This loads the environment variables from the .env file
require('dotenv-extended').load();
var request = require('request');

var rp = require('request-promise');
var LineByLineReader = require('line-by-line'),
    lr = new LineByLineReader('smalltalkQx.txt');

var batchlabels = [];
var count = 0;
const LUIS_APP_URL = "https://westeurope.api.cognitive.microsoft.com/luis/api/v2.0/apps/7bdd8be2-33f1-4be7-9bb8-54e0fe8d15e4/versions/0.1/examples";
var body = [];
// Iterate through the lines
lr.on('line', function (line) {
    var label = {};
    label.text = line;
    //console.log("label.text: " + label.text);
    label.intentName = "SmallTalk"; // change this to the intent name for smalltalk in your luis model
    //console.log("label.intentName: " + label.intentName);
    batchlabels.push(label);
    //console.log("batchlabels: " + JSON.stringify(batchlabels));
    count += 1;
    if (count >= 1473) {
        lr.pause();
        // Process the 100 lines - send as batch to LUIS
        labelsToSend = batchlabels;
        setTimeout(function () {
            console.log("juste avant d'envoyer les bails qui nous interessents");
            //uploadToLuis(labelsToSend);
            //console.log("myBody: " + JSON.stringify(labelsToSend));
            let body=JSON.stringify(labelsToSend)
            for (var i = 1; i < 14; i++){
                console.log(labelsToSend[i * 100]);
            }
            console.log("juste après d'avoir envoyé les bails qui nous interessents");
            batchlabels = [];

            count = 0;
        }, 1000)
        //lr.resume();
    }
});

lr.on('close', function () {
    console.log("on rentre dans la close function");
    uploadToLuis(batchlabels);
    console.log("on sort de la close function, on a uploadé les batchlabels askip");
})


function uploadToLuis(labels) {
    //console.log("lllllllaaaaaaaaaabeeeeeeeeeelllllls:  " + JSON.stringify(labels));
    console.log("ON RENTRE DANS L'UPLOAD");
    var options = {
        method: 'POST',
        uri: LUIS_APP_URL,
        //json: true,
        body: JSON.stringify(labels),
        headers: {
            "Ocp-Apim-Subscription-Key": "97b706dcc753412cadc7bb66d615ce1a",//TODO passer dans les var de heroku
            "Content-Type": "application/json"
        }
    };
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log('Batch post successful.');
            lr.resume();
        }
        else {
            console.log("Ca marche pas fraté");
        }
    })
    //rp(options)
    //    .then(function (body) {
    //        // POST succeeded
    //        console.log('Batch post successful.');
    //        lr.resume();
    //    })
    //    .catch(function (err) {
    //        // POST failed
    //        console.log('Web request failed: ' + err);
    //        lr.close(); // stop line reader
    //        return;
    //    });
}


