// 1 dependencies
const express = require('express')
const expressSession = require('express-session')
const path = require('path')
// installations


//2 instanciations
const app = express()
const port = 5000;

// 3configuratioons
// static files
app.set('view engine', 'pug');
app.set('views',path.join(__dirname,'views'));


// 4middleware
app.use(express.static(path.join(__dirname,'public')));
// para url installations 
app.use(express.urlencoded({extended:false}));
app.use(
    expressSession({
        secret:"My secret",
        resave: false,
        saveUninitialized: false,
    })
)


// 5routes
app.get('/',(req, res)=> (
    res.sendFile(__dirname + "/html/login.html")
))
app.get('/salesDash',(req,res)=>{
    res.sendFile(__dirname  + "/html/salesDash.html")
})
app.get('/NewSales',(req, res)=>{
    res.sendFile(__dirname   + "/html/NewSales.html")
})

app.get('/credit', (req,res)=>{
    res.sendFile(__dirname + "/html/credit.html")
})

app.get('/register',(req,res)=>{
    res.sendFile(__dirname + "/html/register.html" )
})

app.get('/dashstore',(req, res)=>{
    res.sendFile(__dirname + "/html/dashstore.html")
})
app.post('/register',(req,res)=>{
    console.log(req.body)
})

app.get((req,res)=>{
    res.status(404).send("Error , page not found")
})



// this is the second last chunk of code 
// handling non-existent routes
app.use((req,res)=>{
    res.sendFile(404).send('Opps ! Route not found');
})

// bootstrapping server
app.listen(port,()=>console.log(`listening on port ${5000}`));