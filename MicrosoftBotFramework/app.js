'use strict';
var debug = require('debug');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var restify = require('restify');
var builder = require('botbuilder');
var apiairecognizer = require('api-ai-recognizer');


var server = restify.createServer();
var app = express();
process.env.MICROSOFT_APP_ID = '';
process.env.MICROSOFT_APP_PASSWORD = '';
process.env.LUIS_APP_URL = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/5852ed00-7fee-4cf5-86d6-f6f2f4fb9f30?subscription-key=d0a77746cd964a45b2a61a629824e17d&verbose=true&timezoneOffset=0&';


//Setup server restify
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

//Creation chat connector pour communiquer avec le serve bot framework
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});




//listen messages utlisateurs
server.post('/api/messages', connector.listen());


//Reception message utilisateur
var bot = new builder.UniversalBot(connector);




////Ajout reconnaissance LUIS
var luisAppUrl = process.env.LUIS_APP_URL ;
bot.recognizer(new builder.LuisRecognizer(luisAppUrl));

bot.dialog('/Recettes', [
    function (session) {
        session.send('WESHWESHWESHWESH');
    }
]).triggerAction({
    matches: 'Recettes'
    });


////creation dialogue recette
//bot.dialog('RechercheRecette', [
//    //mon code (appel webservice, format de réponse etc...
//    function (session, args, next) {
//        session.send('bonjour, vous avez tapé : %s', session.message.text);
//        console.log("on est dans le dialogue recettes");
//        var intent = args.intent;
//        var produit = builder.EntityRecogniser.findEntity(intent.entities, 'Nourriture');
//        builder.Prompts.text(session, 'Vous recherchez des recettes à base de ' + produit);
        
//    }
//]).triggerAction({ matches: 'Recettes' });//Dialogue lancé ssi l'intent matché est "recettes"




