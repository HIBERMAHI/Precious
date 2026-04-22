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
app.use('/', require('./routes/indexRoutes'))
app.use('/', require('./routes/salesRoutes'))
// app.use('/', require('./routes/l'))


// this is the second last chunk of code 
// handling non-existent routes
app.use((req,res)=>{
    res.status(404).send('Opps ! Route not found');
})

// bootstrapping server
app.listen(port,()=>console.log(`listening on port ${5000}`));