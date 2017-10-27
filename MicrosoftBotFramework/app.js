
﻿'use strict';
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

//ajout reconaissance api.ai(dialogflow)
//var recognizer = new apiairecognizer("30dfeddc13344176b6cefa6c09056e73");

//var intents = new builder.IntentDialog({
//    recognizers: [recognizer]
//});

//console.log(JSON.stringify(intents));

//bot.dialog("whatever", function (session) {
//    session.send('localisation ok ok ok ok ');
//}).triggerAction({ matches: 'intents' });

//bot.dialog("ok", intents);
//intents.matches('Localisation', function (session, args) {
//    session.send("c'est exact")
//})




function parseCookies(cookiesString) {
    var list = {};

    cookiesString && cookiesString.split(';').forEach(function (c1) {
        c1 && c1.split(',').forEach(function (cookie) {
            var parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    });

    return list;
}

function getIdrc(email, mdp, session) {
    return new Promise((resolve, reject) => {
        var options = {
            method: 'POST',
            uri: URL_RC + "ReferentielClient/v1/login",
            body: {
                email: email,
                mdp: mdp
            },
            headers: {
                "Msq-Jeton-App": MSQ_JETON_APP_RC,
                "Msq-App": MSQ_APP_RC
            },
            json: true
        };

        request(options, function (error, response, body) {
            console.log('ok');
            console.log("ceci est l'id apres login RC: " + body.id);
            session.dialogData.idrc = body.id;
            resolve();            
            console.log("terminé l'idrc");
        }, (error, response) => {
            if (error) {
                console.log("erreur pendant la recuperation de l'idrc");
                reject(error);
            }
            else if (response.body.error) {
                console.error('Error: ', response.body.error);
                reject(new Error(response.body.error));
            }
            
        });
    })
}

function getToken(email, mdp, idrc, session) {
    console.log("nous sommes dans le getToken");
    console.log("voici l'idrc dans le getToken: " + idrc);
    var options = {
        url: URL_MCO + '/api/v1/loginRc',
        method: 'POST',
        body: {
            email: email,
            motdepasse: mdp,
            idrc: idrc,
            veutcartefid: false
        },
        json: true,
        
    };
    console.log("options est defini au calme: " + JSON.stringify(options));

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log('ok');
            console.log("Ceci estle token qu'on choppe: " + body.TokenAuthentification);
            session.dialogData.TokenAuthentification = body.TokenAuthentification;
        }
        else {
            console.log("erreur récuperation Token");
        }
    })
}

function getSessionId(email, mdp,session) {
    var options = {
        method: 'POST',
        uri: FO_URL + "Connexion",
        body: {
            txtEmail:email,
            txtMotDePasse: mdp,
            largeur: "800",
            hauteur: "300",
            resteConnecte: true,
        },
        json: true,
        headers: {
            referer: 'http://google.fr'
        }
    };

    request(options, (error, response) => {
        if (!error && response.statusCode == 200) {
            console.log("getAspNetSessionId retourne : " + response.headers['set-cookie']);
            var c = parseCookies(response.headers['set-cookie'].toString());
            console.log("MYCOOOKIIIEEES: " + parseCookies(response.headers['set-cookie'].toString()));
            parseCookies(response.headers['set-cookie'].toString());
            session.dialogData.sessionID = c["ASP.NET_SessionId"];
            console.log("Le ASPSESSIONID est : " + session.dialogData.sessionID);
        }
    })

    var cookieSession = 'ASP.NET_SessionId=' + session.dialogData.sessionID;
    //HitFO sinon ça marche pas.
    request({
        url: FO_URL,
        method: 'GET',
        headers: {
            'cookie': cookieSession
        }
    })
}
bot.dialog('login', [//TODO enlever cette deuxième carte qui apparait pour rien
    function (session) {
        var card = {
            "type": "AdaptiveCard",
            "version": "1.0",
            "body": [
                {
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": 2,
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": "Connexion",
                                    "weight": "bolder",
                                    "size": "medium"
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "Ton e-mail :",
                                    "wrap": true
                                },
                                {
                                    "type": "Input.Text",
                                    "id": "email",
                                    "placeholder": "moi@exemple.com"
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "Ton mot de passe :",
                                    "wrap": true
                                },
                                {
                                    "type": "Input.Text",
                                    "id": "mdp",
                                    "placeholder": "•••••••"
                                }
                            ]
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "En avant!",
                    "data": {
                        'type': 'identifiants'

                    }
                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
        if (session.message && session.message.value) {
            // A Card's Submit Action obj was received
            console.log("ceci est inchallah la data utilisateur: " + JSON.stringify(session.message.value));

            session.dialogData.email = session.message.value.email;//on stocke dans dialogdata car cela nous permet de stocker meme en dehors de ce dialogue et ce même si on demande d'autres inputs'
            session.dialogData.mdp = session.message.value.mdp;
            console.log("email: " + session.dialogData.email);
            console.log("Mot de passe: " + session.dialogData.mdp);
            getIdrc(session.dialogData.email, session.dialogData.mdp, session)
                .then(() => console.log("voyons voir si l'idrc est accessible en dehors de la fonction getidrc: " + session.dialogData.idrc))
                .then(() => getToken(session.dialogData.email, session.dialogData.mdp, session.dialogData.idrc, session))
                .then(() => getSessionId(session.dialogData.email, session.dialogData.mdp, session))
                .then(() => session.send("Vous êtes bien connecté"))
            
        }
    },
    function (session, results) {
        //recuperation idrc ,token, aspnetsession
        session.dialogData.mdp = results.response;
        console.log("email: " + session.dialogData.email);
        console.log("Mot de passe: " + session.dialogData.mdp);
        getIdrc(session.dialogData.email, session.dialogData.mdp, session)
            .then(() => console.log("voyons voir si l'idrc est accessible en dehors de la fonction getidrc: " + session.dialogData.idrc))
            .then(() =>getToken(session.dialogData.email, session.dialogData.mdp, session.dialogData.idrc, session))
            .then(() =>getSessionId(session.dialogData.email, session.dialogData.mdp,session))
            .then(() => session.send("Vous êtes bien connecté"))

        session.endDialog();

    }


]).triggerAction({
    matches: /^login$/i,
});

bot.dialog('getproduit', [   
    function (session) {
        session.send('Je traite ta demande et je reviens vers toi le plus vite possible');    
        var produit = builder.EntityRecognizer.findEntity(args.entities, 'foodName');
        session.dialogData.produit = results.response;
        console.log('${session.dialogData.produit}');
        console.log(session.dialogData.produit);
        var options = {
            method: 'POST',
            uri: FO_URL + "RechercheJs",
            headers: {
                cookie: session.dialogData.sessionID, //TODO Authentification enlever le dur
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
                const limit = Math.min(10, body.length);
                for (var i = 0; i < limit; i++) {
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
    });


bot.dialog('getrecette', [
    function (session) {
        session.send('Je traite ta demande et je reviens vers toi dès que j\'ai trouvé la recette parfaite');
        var produit = builder.EntityRecognizer.findEntity(args.entities, 'Nourriture');
        session.dialogData.ingredient = produit;
        console.log(session.dialogData.ingredient);
        var options = {
            method: 'GET',
            uri: URL_MCO + "/api/v1/recherche/recette?mot=" + session.dialogData.ingredient ,
            headers: {
                TokenAuthentification: '0b5d3d02-b51c-4238-b170-1ef0103b4928', //TODO Faire un login et récuperer le idrc puis le token en appelant un ws
            },
            json: true
        };
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log('ok');
                var msg = new builder.Message(session);
                msg.attachmentLayout(builder.AttachmentLayout.carousel)
                var myCardArray = [];
                const limit = Math.min(10, body.Recettes.length);
                for (var i = 0; i < limit; i++) {                    
                    var ingredientList = "";
                    for (var j = 0; j < body.Recettes[i].IngredientsPrincipaux.length; j++) {
                        ingredientList += body.Recettes[i].IngredientsPrincipaux[j] + ", ";
                    };
                    console.log('liste des ingredients' + ingredientList);
                    const url = "https://drive.intermarche.com/1-nantes-leraudiere/recette/" + body.Recettes[i].IdRecette + "-recette"; //TODO Choisir le bon magasin quand authentification
                    myCardArray.push(
                        new builder.HeroCard(session)
                            .title(body.Recettes[i].Titre)
                            .subtitle(ingredientList)
                            .images([builder.CardImage.create(session, body.Recettes[i].ImageUrl)])
                            .buttons([
                                builder.CardAction.openUrl(session, url, "+ d'infos")
                            ])
                    )
                }
                msg.attachments(myCardArray);
                session.send(msg).endDialog();
            }
        })


    }
]).triggerAction({
    matches: 'Recherche Recette'/*/^recettes$/i*/,
});


//bot.dialog('adaptive', [
//    function (session) {
//        console.log('je suis dans le dialogue adaptive card ');
//        var card = {
//            "type": "AdaptiveCard",
//            "version": "1.0",
//            "body": [
//                {
//                    "type": "ColumnSet",
//                    "columns": [
//                        {
//                            "type": "Column",
//                            "width": 2,
//                            "items": [
//                                {
//                                    "type": "TextBlock",
//                                    "text": "Connexion",
//                                    "weight": "bolder",
//                                    "size": "medium"
//                                },
//                                {
//                                    "type": "TextBlock",
//                                    "text": "Ton e-mail :",
//                                    "wrap": true
//                                },
//                                {
//                                    "type": "Input.Text",
//                                    "id": "email",
//                                    "placeholder": "moi@exemple.com"
//                                },
//                                {
//                                    "type": "TextBlock",
//                                    "text": "Ton mot de passe :",
//                                    "wrap": true
//                                },
//                                {
//                                    "type": "Input.Text",
//                                    "id": "mdp",
//                                    "placeholder": "•••••••"
//                                }
//                            ]
//                        }
//                    ]
//                }
//            ],
//            "actions": [
//                {
//                    "type": "Action.Submit",
//                    "title": "En avant!",
//                    "data": {
//                        'type':'login'

//                    }
//                }
//            ]
//}
    

        
//        session.send(new builder.Message(session).addAttachment({
//            contentType: "application/vnd.microsoft.card.adaptive",
//            content: card
//        }));
//        if (session.message && session.message.value) {
//            // A Card's Submit Action obj was received
//            console.log("ceci est inchallah la data utilisateur: "+ JSON.stringify(session.message.value));
//        }
//    }
//]).triggerAction({
//    matches: /^adaptive$/i,
//    });

//AdaptiveCards.setHostConfig({
//    "spacing": {
//        "small": 3,
//        "default": 8,
//        "medium": 20,
//        "large": 30,
//        "extraLarge": 40,
//        "padding": 20
//    },
//    "separator": {
//        "lineThickness": 1,
//        "lineColor": "#EEEEEE"
//    },
//    "supportsInteractivity": true,
//    "fontFamily": "Segoe UI",
//    "fontSizes": {
//        "small": 12,
//        "default": 14,
//        "medium": 17,
//        "large": 21,
//        "extraLarge": 26
//    },
//    "fontWeights": {
//        "lighter": 200,
//        "default": 400,
//        "bolder": 600
//    },
//    "containerStyles": {
//        "default": {
//            "backgroundColor": "#00000000",
//            "fontColors": {
//                "default": {
//                    "normal": "#333333",
//                    "subtle": "#EE333333"
//                },
//                "accent": {
//                    "normal": "#2E89FC",
//                    "subtle": "#882E89FC"
//                },
//                "attention": {
//                    "normal": "#cc3300",
//                    "subtle": "#DDcc3300"
//                },
//                "good": {
//                    "normal": "#54a254",
//                    "subtle": "#DD54a254"
//                },
//                "warning": {
//                    "normal": "#e69500",
//                    "subtle": "#DDe69500"
//                }
//            }
//        },
//        "emphasis": {
//            "backgroundColor": "#08000000",
//            "fontColors": {
//                "default": {
//                    "normal": "#333333",
//                    "subtle": "#EE333333"
//                },
//                "accent": {
//                    "normal": "#2E89FC",
//                    "subtle": "#882E89FC"
//                },
//                "attention": {
//                    "normal": "#cc3300",
//                    "subtle": "#DDcc3300"
//                },
//                "good": {
//                    "normal": "#54a254",
//                    "subtle": "#DD54a254"
//                },
//                "warning": {
//                    "normal": "#e69500",
//                    "subtle": "#DDe69500"
//                }
//            }
//        }
//    },
//    "imageSizes": {
//        "small": 40,
//        "medium": 80,
//        "large": 160
//    },
//    "actions": {
//        "maxActions": 5,
//        "spacing": 2,
//        "buttonSpacing": 10,
//        "showCard": {
//            "actionMode": 0,
//            "inlineTopMargin": 16
//        },
//        "actionsOrientation": 0,
//        "actionAlignment": 3
//    },
//    "adaptiveCard": {
//        "allowCustomStyle": false
//    },
//    "image": {
//        "size": 3
//    },
//    "imageSet": {
//        "imageSize": 3,
//        "maxImageHeight": 100
//    },
//    "factSet": {
//        "title": {
//            "color": 0,
//            "size": 1,
//            "isSubtle": false,
//            "weight": 2,
//            "wrap": true,
//            "maxWidth": 150
//        },
//        "value": {
//            "color": 0,
//            "size": 1,
//            "isSubtle": false,
//            "weight": 1,
//            "wrap": true
//        },
//        "spacing": 10
//    }
//})

bot.dialog('adaptive2', [
    function (session) {
        console.log('je suis dans le dialogue adaptive card ');
        var card = {
            
	"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.0",
            "body": [
                {
                    "type": "Container",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": "Publish Adaptive Card schema",
                            "weight": "bolder",
                            "size": "medium"
                        },
                        {
                            "type": "ColumnSet",
                            "columns": [
                                {
                                    "type": "Column",
                                    "width": "auto",
                                    "items": [
                                        {
                                            "type": "Image",
                                            "url": "https://pbs.twimg.com/profile_images/3647943215/d7f12830b3c17a5a9e4afcc370e3a37e_400x400.jpeg",
                                            "size": "small",
                                            "style": "person"
                                        }
                                    ]
                                },
                                {
                                    "type": "Column",
                                    "width": "stretch",
                                    "items": [
                                        {
                                            "type": "TextBlock",
                                            "text": "Matt Hidinger",
                                            "weight": "bolder",
                                            "wrap": true
                                        },
                                        {
                                            "type": "TextBlock",
                                            "spacing": "none",
                                            "text": "Created {{DATE(2017-02-14T06:08:39Z,Short)}}",
                                            "isSubtle": true,
                                            "wrap": true
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "Container",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": "Now that we have defined the main rules and features of the format, we need to produce a schema and publish it to GitHub. The schema will be the starting point of our reference documentation.",
                            "wrap": true
                        },
                        {
                            "type": "FactSet",
                            "facts": [
                                {
                                    "title": "Board:",
                                    "value": "Adaptive Card"
                                },
                                {
                                    "title": "List:",
                                    "value": "Backlog"
                                },
                                {
                                    "title": "Assigned to:",
                                    "value": "Matt Hidinger"
                                },
                                {
                                    "title": "Due date:",
                                    "value": "Not set"
                                }
                            ]
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.ShowCard",
                    "title": "Set due date",
                    "card": {
                        "type": "AdaptiveCard",
                        "body": [
                            {
                                "type": "Input.Date",
                                "id": "dueDate",
                                "title": "Select due date"
                            }
                        ],
                        "actions": [
                            {
                                "type": "Action.Submit",
                                "title": "OK"
                            }
                        ]
                    }
                },
                {
                    "type": "Action.ShowCard",
                    "title": "Comment",
                    "card": {
                        "type": "AdaptiveCard",
                        "body": [
                            {
                                "type": "Input.Text",
                                "id": "comment",
                                "isMultiline": true,
                                "placeholder": "Enter your comment"
                            }
                        ],
                        "actions": [
                            {
                                "type": "Action.Submit",
                                "title": "OK"
                            }
                        ]
                    }
                },
                {
                    "type": "Action.OpenUrl",
                    "title": "View",
                    "url": "http://adaptivecards.io"
                }
            ]
        }
        
        var msg = new builder.Message(session);
        msg.addAttachment(card);
        session.send(msg);
    }
]).triggerAction({
    matches: /^adaptive2$/i,
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


