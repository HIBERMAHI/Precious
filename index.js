const express = require('express')
const expressSession = require('express-session')
const path = require('path')
// installations

const app = express()
const port = 5000;


// para url installations 
app.use(express.urlencoded({extended:false}));
app.use(
    expressSession({
        secret:"My secret",
        resave: false,
        saveUninitialized: false,
    })
)

// static files
app.use(express.static(path.join(__dirname,'public')))


app.get('/',(req, res)=> (
    res.sendFile(__dirname + "/html/login.html")
))

app.get('/register',(req,res)=>{
    res.sendFile(__dirname + "/html/register.html" )
})
app.post('/register',(req,res)=>{
    console.log(req.body)
})

app.get((req,res)=>{
    res.status(404).send("Error , page not found")
})

app.listen(port,()=>console.log(`listening on port ${5000}`))