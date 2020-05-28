require('dotenv').config()

const Nexmo = require('nexmo')
const nexmo = new Nexmo({
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
    applicationId: process.env.APPLICATION_ID,
    privateKey: process.env.PRIVATE_KEY_FILE
})

var text = 'hola mundo'

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

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))


app.post('/api/verify-request', (req, res) => {
    console.log(req.body)
    
    let response = {}

    // verify request
    nexmo.verify.request({
        number: req.body.phone_number,
        brand: process.env.BRAND_NAME
    }, (err,result)=>{
        if (err) {
            console.error(err);
        } 
        else {
            const verifyRequestId = result.request_id
            response.nexmo_verify = result.request_id
            
            console.log('request_id', verifyRequestId)

            // return response
            res.status(200).end(JSON.stringify(response))
        }
    })
})

// inbound message websocket handler
app.post('/api/verify-check', (req, res) => {
    console.log(req.body)

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

app.listen(80) // port listening