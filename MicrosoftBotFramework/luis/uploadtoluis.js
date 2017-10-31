/*-----------------------------------------------------------------------------
This script uploads all the small talk utterances to a single small talk intent 
in LUIS. When a user's utterance falls into the small talk intent, it should go
to the QnA maker to obtain a response. 
-----------------------------------------------------------------------------*/

// This loads the environment variables from the .env file
require('dotenv-extended').load();

var rp = require('request-promise');
var LineByLineReader = require('line-by-line'),
    lr = new LineByLineReader('smalltalkQ.txt');

var batchlabels = [];
var count = 0;
const LUIS_APP_URL = "https://westeurope.api.cognitive.microsoft.com/luis/api/v2.0/apps/7bdd8be2-33f1-4be7-9bb8-54e0fe8d15e4/versions/0.1/examples";

// Iterate through the lines
lr.on('line', function (line) {
    var label = {};
    label.text = line;
    label.intentName = "SmallTalk"; // change this to the intent name for smalltalk in your luis model
    batchlabels.push(label);
    count += 1;
    if (count >= 100) {
        lr.pause();
        // Process the 100 lines - send as batch to LUIS
        labelsToSend = batchlabels;
        setTimeout(function () {
            uploadToLuis(labelsToSend);
            batchlabels = [];
            count = 0;
        }, 1000)
    }
});

lr.on('close', function () {
    uploadToLuis(batchlabels)
})


function uploadToLuis(labels) {
    console.log("lllllllaaaaaaaaaabeeeeeeeeeelllllls:  " + JSON.stringify(labels));
    var options = {
        method: 'POST',
        uri: LUIS_APP_URL,
        json: true,
        body: JSON.stringify(labels),
        headers: {
            "Ocp-Apim-Subscription-Key": "97b706dcc753412cadc7bb66d615ce1a",//TODO passer dans les var de heroku
            "Content-Type": "application/json"
        }
    };
    rp(options)
        .then(function (body) {
            // POST succeeded
            console.log('Batch post successful.');
            lr.resume();
        })
        .catch(function (err) {
            // POST failed
            console.log('Web request failed: ');
            lr.close(); // stop line reader
            return;
        });
}