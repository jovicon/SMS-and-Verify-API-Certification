require('dotenv').config()

const Nexmo = require('nexmo')
const nexmo = new Nexmo({
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
    applicationId: process.env.APPLICATION_ID,
    privateKey: process.env.PRIVATE_KEY_FILE
})

// // enviando mensaje
// nexmo.message.sendSms(
//     process.env.FROM_NUMBER, 
//     process.env.TO_NUMBER, 
//     text, 
//     {
//         type: "unicode"
//     }, 
//     (err, responseData) => {
//         if (err) {
//             console.log(err);
//         } 
//         else {
//             if (responseData.messages[0]['status'] === "0") {
//                 console.log("Message sent successfully.");
//             } 
//             else {
//                 console.log(`Message failed with error: ${responseData.messages[0]['error-text']}`);
//             }
//         }
//     }
// )

// nexmo.verify.request({
//     number: process.env.TO_NUMBER,
//     brand: process.env.BRAND_NAME
// }, (err,result)=>{
//     if (err) {
//         console.error(err);
//       } else {
//         const verifyRequestId = result.request_id
//         console.log('request_id', verifyRequestId)
//       }
// })


const express = require('express')
const bodyParser = require('body-parser')

const app = express()

const loki = require('lokijs');
var db = new loki('db.db', {
	autoload: true,
	autoloadCallback : databaseInitialize,
	autosave: true, 
	autosaveInterval: 4000 // save every four seconds for our example
})

// implement the autoloadback referenced in loki constructor
function databaseInitialize() {

    // on the first load of (non-existent database), we will have no collections so we can 
    //   detect the absence of our collections and add (and configure) them now.
    var users = db.getCollection("users")
    if (users === null) {
        users = db.addCollection("users")
    }

    // kick off any program logic or start listening to external events
    // runProgramLogic();
    return users
}

// While we could have done this in our databaseInitialize function, 
//   lets split out the logic to run 'after' initialization into this 'runProgramLogic' function
function runProgramLogic() {
    var entries = db.getCollection("entries");
    var entryCount = entries.count();
    var now = new Date();
  
    console.log("old number of entries in database : " + entryCount);
  
    entries.insert({ x: now.getTime(), y: 100 - entryCount });
    entryCount = entries.count();
  
    console.log("new number of entries in database : " + entryCount);
    console.log("");
    console.log("Wait 4 seconds for the autosave timer to save our new addition and then press [Ctrl-c] to quit")
    console.log("If you waited 4 seconds, the next time you run this script the numbers should increase by 1");
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))



app.post('/api/verify-request', (req, res) => {
    console.log(req.body)
    
    let response = {}
    let users = databaseInitialize()

    let allUsers = users.chain().simplesort("id").data()
    console.log(allUsers.length)
    
    // get verified number
    let userExist = users.findObject({'phone_number': req.body.phone_number});
    let userNotVerified = users.findObject({'phone_number':req.body.phone_number,'verified':false});
    
    console.log('all users')
    console.log(allUsers)

    console.log('userExist')
    console.log(userExist)

    console.log('userNotVerified')
    console.log(userNotVerified)
    
    if (userExist == null || userNotVerified != null) {
        // verify request
        nexmo.verify.request({
            number: req.body.phone_number,
            brand: process.env.BRAND_NAME
        }, (err,result)=> {
            if (err) {
                console.error(err);
            } 
            else {
                const verifyRequestId = result.request_id
                response.nexmo_verify = result.request_id
                
                console.log('request_id', verifyRequestId)
    
                if (userExist == null) {
                    users.insert({
                        id: allUsers.length + 1,
                        name: req.body.name,
                        phone_number: req.body.phone_number,
                        request_id: verifyRequestId,
                        verified: false
                    })
                }

                if (userNotVerified != null) {
                    userNotVerified.name = req.body.name
                    userNotVerified.request_id = result.request_id
                    users.update(userNotVerified)
                }
                
                // return response
                res.status(200).end(JSON.stringify(response))
            }
        })
    }
    else {
        res.status(200).end(JSON.stringify( {response:'this phone is already verified'} ))
    }
})

// inbound message websocket handler
app.post('/api/verify-check', (req, res) => {
    console.log(req.body)

    let users = databaseInitialize()
    let userNotVerified = users.findObject({'phone_number':req.body.phone_number,'verified':false});
    let userVerified = users.findObject({'phone_number':req.body.phone_number,'verified':true});

    if (userNotVerified != null) {
        nexmo.verify.check({
            request_id: userNotVerified.request_id,
            code: req.body.sms_code.toString()
        }, (err, result) => {
            if (err) {
                console.error('error')
                console.error(err)
    
                res.status(400).end(JSON.stringify(err))
            }
            else {
                if ( result.status == 0 ) {
                    console.log('success')
                    userNotVerified.verified = true
                    users.update(userNotVerified)
                }

                res.status(200).end(JSON.stringify(result))
            }
        })
    }
    else if (userVerified != null) {
        res.status(200).end(JSON.stringify( {response:'this user is already verified.'} ))
    }
    else {
        res.status(200).end(JSON.stringify( {response:'you have to send a verify request first.'} ))
    }
})


// message status websocket handler
app.post('/api/list-user', (req, res) => {
    console.log(req.body)
    let users = databaseInitialize()
    let allUsers = users.chain().simplesort("id").data()
    let response = []

    // doing this we hide phone_number user
    allUsers.forEach( function(user, indice, array) {
        console.log("En el índice " + indice + " hay este valor: " + user.name);
        
        let buildUser = {
            id: user.id,
            name: user.name
        }

        response.push(buildUser)
    });

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.status(200).end(JSON.stringify(response))
})

// message status websocket handler
app.post('/api/create-chat', (req, res) => {
    console.log(req.body)

    let users = databaseInitialize()
    let user_a = users.findObject({'id':req.body.id_1})
    let user_b = users.findObject({'id':req.body.id_2})

    console.log(user_a)
    console.log(user_b)

    if (user_a && user_b) {
        // create chat
        res.writeHead(200, {'Content-Type': 'application/json'});
        
        // message to user_a
        nexmo.message.sendSms(
            process.env.FROM_NUMBER,
            user_a.phone_number,
            `Reply to this SMS to talk to ${user_b.name}`
        );
      
        // message to user_b
        nexmo.message.sendSms(
            process.env.FROM_NUMBER,
            user_b.phone_number,
            `Reply to this SMS to talk to ${user_a.name}`
        );

        res.status(200).end(
            JSON.stringify (
                { message: "Sala de chat creada satisfactoriamente." }
            )
        )
    }
    else {

        // user_b doesn't exist
        if (user_a) {
            res.status(200).end(JSON.stringify({ message: "User b doesn't exist" }))
        }
        // user_b doesn't exist
        else {
            res.status(200).end(JSON.stringify({ message: "User a doesn't exist" }))
        }
    }
})


// message status websocket handler
app.post('/webhooks/message-status', (req, res) => {
    console.log('received body', req.body)
    console.log('received request', req.query);
})

// inbound message websocket handler
app.post('/webhooks/inbound-message', (req, res) => {
    console.log(req.body)
    res.status(200).end()
})


app.listen(80)