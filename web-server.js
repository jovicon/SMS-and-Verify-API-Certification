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
    
    if (userExist == null || userExist != null) {
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

    nexmo.verify.check({
        request_id: req.body.request_id,
        code: req.body.sms_code.toString()
    }, (err, result) => {
        if (err) {
            console.error('error')
            console.error(err)

            res.status(400).end(JSON.stringify(err))
        }
        else {
            console.error('success')
            
            res.status(200).end(JSON.stringify(result))
        }
    })
})


// message status websocket handler
app.post('/webhooks/message-status', (req, res) => {
    console.log(req.body)
    res.status(200).end()
})

app.listen(80)