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
var http = require('http');
var request = require('request');
const FO_URL = 'https://drive.intermarche.com/';


var server = restify.createServer();
var app = express();
process.env.MICROSOFT_APP_ID = '';//'0bff99a1-6ffd-4eea-aef2-2728bdb196db';
process.env.MICROSOFT_APP_PASSWORD = '';//'wajNZqXpd82xoieFBcgt37y';
process.env.LUIS_APP_URL = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/5852ed00-7fee-4cf5-86d6-f6f2f4fb9f30?subscription-key=d0a77746cd964a45b2a61a629824e17d';

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



//var bot = new builder.UniversalBot(connector, function (session) {
//    session.send("Hi... We sell shirts. Say 'show shirts' to see our products.");
//});

//// Add dialog to return list of shirts available
//bot.dialog('showShirts', function (session) {
//    var msg = new builder.Message(session);
//    msg.attachmentLayout(builder.AttachmentLayout.carousel)
//    msg.attachments([
//        new builder.HeroCard(session)
//            .title("Classic White T-Shirt")
//            .subtitle("100% Soft and Luxurious Cotton")
//            .text("Price is $25 and carried in sizes (S, M, L, and XL)")
//            .images([builder.CardImage.create(session, 'http://petersapparel.parseapp.com/img/whiteshirt.png')])
//            .buttons([
//                builder.CardAction.imBack(session, "buy classic white t-shirt", "Buy")
//            ]),
//        new builder.HeroCard(session)
//            .title("Classic Gray T-Shirt")
//            .subtitle("100% Soft and Luxurious Cotton")
//            .text("Price is $25 and carried in sizes (S, M, L, and XL)")
//            .images([builder.CardImage.create(session, 'http://petersapparel.parseapp.com/img/grayshirt.png')])
//            .buttons([
//                builder.CardAction.imBack(session, "buy classic gray t-shirt", "Buy")
//            ])
//    ]);
//    session.send(msg).endDialog();
//}).triggerAction({ matches: /^(show|list)/i });

//Reception message utilisateur
var bot = new builder.UniversalBot(connector, function (session) {
    session.send("SALUT SALUT");
});




////Ajout reconnaissance LUIS
var recognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/5852ed00-7fee-4cf5-86d6-f6f2f4fb9f30?subscription-key=d0a77746cd964a45b2a61a629824e17d&timezoneOffset=0&verbose=true');
bot.recognizer(recognizer);

bot.dialog('getproduit', [    
    function (session) {
        session.send('Bienvenue sur le service de courses d\'intermarché');
        builder.Prompts.text(session, 'Merci de rentrer le produit que vous recherchez (par exemple: poulet');
    },
    function (session, results) {
        session.dialogData.produit = results.response;
        console.log('${session.dialogData.produit}');
        console.log(session.dialogData.produit);
        var options = {
            method: 'POST',
            uri: FO_URL + "RechercheJs",
            headers: {
                cookie: 'ASP.NET_SessionId=f1kgi0xdluvchzm55clvhcqp',
            },
            body: {
                mot: session.dialogData.produit
            },
            json: true
        };
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log('ok');
                var msg = new builder.Message(session);
                msg.attachmentLayout(builder.AttachmentLayout.carousel)
                var myCardArray = [];
                for (var i = 0; i < 10; i++) {
                    myCardArray.push(
                        new builder.HeroCard(session)
                            .title(body[i].Libelle)
                            .text(body[i].Prix + ' (' + body[i].Conditionnement + ')')
                            .subtitle(body[i].PrixParQuantite)                            
                            .images([builder.CardImage.create(session, body[i].NomImage)])
                            .buttons([
                                builder.CardAction.imBack(session, "Ajouter au panier", "Ajouter au panier")
                            ])
                    )
                }
                msg.attachments(myCardArray);                
                session.send(msg).endDialog();
            }
        })
  
        
    }
]).triggerAction({
    matches: /^courses$/i,
    confirmPrompt:"t'as plus besoin d'aide?"
    });


bot.dialog('recettes', [
    function (session) {
        session.send('Recettes');
    }
]).triggerAction({
    matches: 'Recettes',
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




