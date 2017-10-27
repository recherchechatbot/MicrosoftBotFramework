

var debug = require('debug');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var restify = require('restify');
var builder = require('botbuilder');
var apiairecognizer = require('api-ai-recognizer');
var http = require('http');
var request = require('request');
var AdaptiveCards = require('microsoft-adaptivecards');
const FO_URL = 'https://drive.intermarche.com/';
const URL_MCO = process.env.URL_MCO;
const URL_RC = process.env.URL_RC;
const MSQ_JETON_APP_RC = process.env.MSQ_JETON_APP_RC;
const MSQ_APP_RC = process.env.MSQ_APP_RC;


var server = restify.createServer();
var app = express();
const MICROSOFT_APP_ID = process.env.MICROSOFT_APP_ID;
const MICROSOFT_APP_PASSWORD = process.env.MICROSOFT_APP_PASSWORD;

const LUIS_APP_URL = process.env.LUIS_APP_URL;

//Setup server restify
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

//Creation chat connector pour communiquer avec le serve bot framework
var connector = new builder.ChatConnector({
    appId: MICROSOFT_APP_ID,
    appPassword: MICROSOFT_APP_PASSWORD
});




//listen messages utlisateurs
server.post('/api/messages', connector.listen());



//Reception message utilisateur
var bot = new builder.UniversalBot(connector, function (session) {
    session.send("SALUT SALUT");
});




//Ajout reconnaissance LUIS
var recognizer = new builder.LuisRecognizer(LUIS_APP_URL);
bot.recognizer(recognizer);


    
bot.dialog('getproduit', [ //TODO le faire marcher  
    function (session) {
        let msg = {
            "type": "message",
            "text": "Vous êtes pressé ? L’Ajout Express vous permet d’ajouter des produits à votre panier en seulement quelques clics.Rien de plus simple, sélectionnez cette option lorsque vous êtes dans votre panier sur le site de courses en ligne.En cliquant sur le bouton ci- dessous, vous accédez directement aux rayons puis aux sous- familles.Vous n’avez plus qu’à compléter votre panier.",
            "attachments": [
                {
                    "contentType": "image/png",
                    "contentUrl": "https://img4.hostingpics.net/pics/782644Capture.png",
                    "name": "Ajout Express"
                }
            ],
            
        };
        session.send(msg);

    }
]).triggerAction({
    matches: 'FAQ.Ajout.Express',
});