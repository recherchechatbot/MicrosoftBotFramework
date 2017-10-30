'use strict';
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

function getEntityElement(message,session) {
    return new Promise((resolve, reject) => {
        var options = {
            method: 'GET',
            uri: LUIS_APP_URL + message,
            json: true
        };
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log("constate mon body: " + JSON.stringify(body));
                console.log("body.entities[0]" + body.entities[0]);
                console.log("body.entities[0].resolution" + body.entities[0].resolution);
                console.log("body.entities[0].resolution.values[0]" + body.entities[0].resolution.values[0]);
                console.log("body.entities[0] stringifyisé" + JSON.stringify(body.entities[0]));
                console.log("body.entities[0].resolution stringifyisé" + JSON.stringify(body.entities[0].resolution));
                console.log("body.entities[0].resolution.values[0] stringifyisé" + JSON.stringify(body.entities[0].resolution.values[0]));
                session.userData.produit = JSON.stringify(body.entities[0].resolution.values[0]);
                resolve();
                
                
            }
            else {
                console.log('erreur recuperation element');

            }
        })
    })
};

function getRecette(token, produit,session) {
    console.log("Debut getRecette");
    console.log('le produit qu\'on utilise: ' + produit);
    console.log('token qu\'on utilise: ' + token);
    var options = {
        method: 'GET',
        uri: URL_MCO + "/api/v1/recherche/recette?mot=" + produit,
        headers: {
            TokenAuthentification: token, 
        },
        json: true
    };
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
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
        else {
            console.log("erreur recherche recette");
            session.send("Je suis désolé mais je n'ai pas trouvé de recette correspondant à ta recherche 😔 ")
        }
    })
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
            session.userData.idrc = body.id;
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
            session.userData.TokenAuthentification = body.TokenAuthentification;
            session.save();
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
            session.userData.sessionID = c["ASP.NET_SessionId"];
            console.log("Le ASPSESSIONID est : " + session.userData.sessionID);
        }
    })

    var cookieSession = 'ASP.NET_SessionId=' + session.userData.sessionID;
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

            session.userData.email = session.message.value.email;//on stocke dans userData car cela nous permet de stocker meme en dehors de ce dialogue et ce même si on demande d'autres inputs'
            session.userData.mdp = session.message.value.mdp;
            console.log("email: " + session.userData.email);
            console.log("Mot de passe: " + session.userData.mdp);
            getIdrc(session.userData.email, session.userData.mdp, session)
                .then(() => console.log("voyons voir si l'idrc est accessible en dehors de la fonction getidrc: " + session.userData.idrc))
                .then(() => getToken(session.userData.email, session.userData.mdp, session.userData.idrc, session))
                .then(() => getSessionId(session.userData.email, session.userData.mdp, session))
                .then(() => session.send("Vous êtes bien connecté"))
            
        }
    },
    function (session, results) {
        //recuperation idrc ,token, aspnetsession
        session.userData.mdp = results.response;
        console.log("email: " + session.userData.email);
        console.log("Mot de passe: " + session.userData.mdp);
        getIdrc(session.userData.email, session.userData.mdp, session)
            .then(() => console.log("voyons voir si l'idrc est accessible en dehors de la fonction getidrc: " + session.userData.idrc))
            .then(() =>getToken(session.userData.email, session.userData.mdp, session.userData.idrc, session))
            .then(() =>getSessionId(session.userData.email, session.userData.mdp,session))
            .then(() => session.send("Vous êtes bien connecté"))

        session.endDialog();

    }


]).triggerAction({
    matches: /^login$/i,
});

bot.dialog('getproduit', [ //TODO le faire marcher  
    function (session) {
        session.send('Je traite ta demande et je reviens vers toi le plus vite possible');    
        var produit = builder.EntityRecognizer.findEntity(args.entities, 'foodName');
        session.userData.produit = results.response;
        console.log('${session.userData.produit}');
        console.log(session.userData.produit);
        var options = {
            method: 'POST',
            uri: FO_URL + "RechercheJs",
            headers: {
                cookie: session.userData.sessionID, 
            },
            body: {
                mot: session.userData.produit
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
        var userMessage = session.message.text;
        getEntityElement(userMessage,session)
            .then(() => getRecette(session.userData.TokenAuthentification, session.userData.produit,session))
    }
]).triggerAction({
    matches: 'Recherche Recette'/*/^recettes$/i*/,
});


//<<<<<<<<<<<<<<<<<<<<<<FAQ>>>>>>>>>>>>>>>>>>>>>>>>>>>

bot.dialog('ajoutExpress', [
    function (session) {
        session.sendTyping();
        let msg = {
            "type": "message",
            "text": "Tu es pressé ? L’Ajout Express te permet d’ajouter des produits à ton panier en seulement quelques clics. Rien de plus simple, sélectionne cette option lorsque tu es dans ton panier sur le site de courses en ligne.En cliquant sur le bouton ci- dessous, tu accedes directement aux rayons puis aux sous-familles.Tu n’as plus qu’à compléter ton panier.",
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

bot.dialog('listeCourses', [
    function (session) {
        session.sendTyping();
        session.send("La liste de courses procure un gain de temps considérable. Elle te donne la possibilité par un simple clic de déposer dans ton panier les articles que tu commandes régulièrement.Pour que tes prochaines commandes soient plus rapides, tu peux créer des listes thématiques. Remplis ton panier avec les articles désirés, clique ensuite sur « Aller en caisse », puis clique sur le lien « Tout ajouter à une liste ». Donne un nom à ta liste et le tour est joué ! Ta liste de courses est enregistrée, tu pourras la réutiliser lors de ta prochaine visite sur notre site.");
    }
]).triggerAction({
    matches: 'FAQ.Liste.Courses',
    });

bot.dialog('consulterListeCourses', [
    function (session) {
        session.sendTyping();
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
                                            "text": "Pour consulter ta liste de courses, tu dois être connecté à ton compte. Tu pourras alors consulter ta liste de courses directement en cliquant ci-dessous. Si tu veux te connecter, tu peux le faire ici en tapant \"login\" ", "wrap": true
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                        "actions": [
                            {
                                "type": "Action.OpenUrl",
                                "url": "/mon-compte/mes-listes-de-courses",
                                "title": "Par ici!"

                            }
                        ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }
]).triggerAction({
    matches: 'FAQ.Consulter.Liste.Courses',
});

bot.dialog('ancienneCommande', [
    function (session) {
        session.sendTyping();
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
                                    "text": "Il faut que tu te rendes dans ton compte. Tu peux y acceder en cliquant sur le lien ci-dessous 😁. Dans « Historique de mes commandes », sélectionne la commande concernée et clique sur « Transformer en liste ».", "wrap": true
                                }
                            ]
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "url": "/mon-compte/mes-commandes",
                    "title": "Mon compte"

                }
            ]
        }

        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }
]).triggerAction({
    matches: 'FAQ.Ancienne.Commande',
});

bot.dialog('produitFavori', [
    function (session) {
        session.sendTyping();
        session.send("Tu peux ajouter un produit dans tes favoris en cliquant sur le coeur situé à coté de ce dernier. Tu pourras le retrouver ensuite dans l’onglet « Mon Drive malin ».");
    }
]).triggerAction({
    matches: 'FAQ.Produit.Favori',
    });

bot.dialog('oubliMdp', [
    function (session) {
        session.sendTyping();
        session.send("Lors de ta connexion sur le site, clique sur « J’ai oublié mon mot de passe ». Tu recevra un email avec un lien sur lequel il faudra cliquer pour pouvoir renseigner un nouveau mot de passe. Pense à vérifier tes courriers indésirables si tu n’as pas reçu l’email après quelques minutes 😉.");        
    }

]).triggerAction({
    matches: 'FAQ.Oubli.Mdp',
});

bot.dialog('suppressionCompte', [
    function (session) {
        session.sendTyping();
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
                                    "text": "Tu peux à tout moment supprimer ton compte en cliquant sur le bouton ci-dessous. Conformémemt à la loi \"Informatique et Liberté\" (art 38, 39 & 40 de la loi Informatiques et Libertés modifiée du 6 juillet 1978), tu disposes d'un droit d'accès, de modification, de rectification et de suppression des données te concernant. Tu peux exercer ce droit en nous contactant par email à l'adresse suivante: intermarche@mousquetaires.com", "wrap": true
                                }
                            ]
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "url": "/mon-compte/mon-profil",
                    "title": "Mon compte"

                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }

]).triggerAction({
    matches: 'FAQ.Suppression.Compte',
    });

bot.dialog('changementMagasin', [
    function (session) {
        session.sendTyping();
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
                                    "text": "Si tu souhaites passer commande dans un autre magasin, je t'invite à cliquer sur le bouton ci-dessous. Dans \"Mes magasins\", clique sur \"changer de magasin\" puis entre le code postal du magasin sur lequel tu veux passer commande", "wrap": true
                                }
                            ]
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "url": "/mon-compte/mes-magasins",
                    "title": "Mes magasins"

                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }

]).triggerAction({
    matches: 'FAQ.Changement.Magasin',
    });

bot.dialog('newsletter', [
    function (session) {
        session.sendTyping();
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
                                    "text": "Tu peux à tout moment modifier tes abonnements pour recevoir ou non nos communications par email, par SMS ou par voie postale en cliquant sur le bouton ci-dessous", "wrap": true
                                }
                            ]
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "url": "/mon-compte/mon-profil",
                    "title": "Mon compte"

                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }

]).triggerAction({
    matches: 'FAQ.Newsletter',
    });

bot.dialog('confirmationCommande', [
    function (session) {
        session.sendTyping();
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
                                    "text": "Si ta commande a bien été prise en compte, tu vas recevoir un email de confirmation de commande. Tu peux également te rendre dans ton compte dans la rubrique « Mes commandes en cours » en cliquant ci-dessous", "wrap": true
                                }
                            ]
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "url": "/mon-compte/mes-commandes",
                    "title": "Mes commandes"

                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }

]).triggerAction({
    matches: 'FAQ.Confirmation.Commande',
    });

bot.dialog('changementHoraire', [
    function (session) {
        session.sendTyping();
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
                                    "text": "Si tu souhaites modifier ton horaire de livraison ou de retrait, rend-toi dans ton compte en cliquant sur le bouton ci-dessous. Dans \"Mes commandes en cours\", sélectionne la commande que tu souhaites modifier. Si ta commande est en statut \"en préparation\" il est malheuresement dejà trop tard pour la modifier 😕.", "wrap": true
                                }
                            ]
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "url": "/mon-compte/mes-commandes",
                    "title": "Mes commandes"

                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }

]).triggerAction({
    matches: 'FAQ.Changement.Horaire',
});

bot.dialog('produitManquant', [
    function (session) {
        session.sendTyping();
        session.send("En cas de produits manquants lors de ta livraison, ton livreur t'en informera et ceux-ci ne te seront pas facturés.");
    }

]).triggerAction({
    matches: 'FAQ.Produit.Manquant',
});

bot.dialog('delaiLivraison', [
    function (session) {
        session.sendTyping();
        session.send("Le délai de livraison dépend du planning proposé par ton Intermarché et du créneau horaire que tu auras choisi.");
    }

]).triggerAction({
    matches: 'FAQ.Delai.Livraison',
});

bot.dialog('produitIntrouvable', [
    function (session) {
        session.sendTyping();
        session.send("Si tu souhaites commander un produit mais que celui-ci n'apparaît pas, il est fort probable qu'il ne soit plus disponible. N'hésite pas à revenir régulièrement sur notre site, des réapprovisionnements sont réalisés fréquemment.");
    }

]).triggerAction({
    matches: 'FAQ.Produit.Introuvable',
});

bot.dialog('produitsFrais', [
    function (session) {
        session.sendTyping();
        session.send("Nos véhicules de livraison sont réfrigérés. Ce mode de livraison permet de conserver tous les types de produits (surgelés, frais…) du magasin à ton domicile. \n Si tu choisis le mode Drive, tes produits frais et surgelés sont conservés à la bonne température jusqu’au retrait");
    }

]).triggerAction({
    matches: 'FAQ.Produits.Frais',
});

bot.dialog('produitTrad', [
    function (session) {
        session.sendTyping();
        session.send("Sur notre site de courses en ligne, tu peux commander des produits à la coupe comme si tu étais au rayon boucherie, poissonnerie, ou encore fromagerie de ton magasin. De même, de nombreux fruits et légumes te sont proposés. \n Dans ton panier, tu peux ajouter des commentaires sur tes produits dans la rubrique « Commentaires pour le livreur » pour aider ton préparateur à répondre au mieux à tes attentes. Exemple : « Je souhaite des bananes très mûres », « Je préfère des tranches de jambon très fines »…");
    }

]).triggerAction({
    matches: 'FAQ.Produit.Trad',
    });

bot.dialog('differencePrix', [
    function (session) {
        session.sendTyping();
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
                                    "text": "Les prix sur le site drive.intermarche.com sont les mêmes que les prix en magasin. Si tu constates une différence de prix entre le site et ton point de vente tu peux nous en informer en appelant le numero ci-dessous", "wrap": true
                                },
                                {
                                    "type": "Image",
                                    "url": "https://driveimg1.intermarche.com/fr/Content/images/compte/BannieresSAV.jpg",
                                    "size": "stretch"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
        
    }

]).triggerAction({
    matches: 'FAQ.Difference.Prix',
});

bot.dialog('modePaiement', [
    function (session) {
        session.sendTyping();
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
                                    "text": "Plusieurs modes de paiement sont disponibles selon le mode de livraison choisi ainsi que le magasin sélectionné :", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "-Pour la livraison, auprès de ton livreur et ce par chèque ou carte bancaire*.", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "-Pour le retrait, tu peux payer soit pas carte bancaire soit par chèque auprès du personnel du magasin*", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "-Sur notre site, tu peux payer ta commande directement en ligne par carte bancaire*.", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "-Enfin, pour les commandes Drive, tu pourras payer directement à la borne*.", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": " ", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "*Voir conditions avec ton magasin", "wrap": true
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }

]).triggerAction({
    matches: 'FAQ.Modes.Paiement',
    });

bot.dialog('montantMinimum', [
    function (session) {
        session.sendTyping();
        session.send("Pour connaître le montant minimum d’achat proposé par votre magasin, rendez - vous sur la page d’accueil au niveau du logo (en haut à gauche), cliquez sur le nom de votre magasin puis allez sur « Voir les plannings ».");
    }
]).triggerAction({
    matches: 'FAQ.Montant.Minimum',
    });

bot.dialog('securitéTransactions', [
    function (session) {
        session.sendTyping();
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
                                    "text": "A chaque étape, ton paiement en ligne est 100% sécurisé! Aucune information ne transite en clair sur le site : le serveur est en mode crypté et toutes les informations sont codées. Le fait de communiquer ton numéro de carte de crédit sur le serveur bancaire au moment du paiement de ta commande est entièrement sécurisé.", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "Par ailleurs, tu remarqueras dans ton navigateur internet une adresse commençant par https:// ainsi qu’un cadenas. Intermarché n’a jamais accès à tes coordonnées et ne les conserve en aucun cas sur ses serveurs.", "wrap": true
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }

]).triggerAction({
    matches: 'FAQ.Sécurité.Transactions',
});

bot.dialog('refusPaiement', [
    function (session) {
        session.sendTyping();
        session.send("Si ton paiement est refusé, pas de panique, ton Intermarché te contactera afin de trouver une solution 😉.");
    }
]).triggerAction({
    matches: 'FAQ.Refus.Paiement',
    });

bot.dialog('debitCommande', [
    function (session) {
        session.sendTyping();
        session.send("Pour le règlement par carte de crédit en ligne, le débit est effectué lors de la livraison de la commande à la condition d’avoir obtenu préalablement l’autorisation de débit de ton compte auprès des centres de paiement compétents, faute de quoi, ta commande ne pourra être prise en compte.");
    }
]).triggerAction({
    matches: 'FAQ.Debit.Commande',
    });

bot.dialog('demandeCarte', [
    function (session) {
        session.sendTyping();
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
                                    "text": "Pour bénéficier des avantages liés au programme, il faut adhérer au programme de fidélité Intermarché", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "Tu peux obtenir ta carte gratuitement soit: ", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "-En te rendant à l'accueil de ton magasin", "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "-En faisant la demande dans ton espace client en cliquant sur le bouton ci-dessous", "wrap": true
                                }
                            ]
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "url": "/mon-compte/ma-carte-intermarche",
                    "title": "Ma carte fidelité"

                }
            ]
        }
        session.send(new builder.Message(session).addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
        }));
    }

]).triggerAction({
    matches: 'FAQ.Demande.Carte',
});






