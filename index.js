import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";
import session from "express-session";
import dotenv from 'dotenv';

// Configure dotenv to load environment variables from .env file
dotenv.config();


const app = express();
const port = 3000;

const db = new pg.Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 30000, // 30 seconds
    idleTimeoutMillis: 30000, // 30 seconds
});

db.connect();

let titleArr = [];
let contentArr = [];
let dateArr = [];
var city = "", temperature;
var isLogged = false;
let currUser, name;
const API = process.env.API_KEY;

// Middleware for parsing JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.get("/", (req, res) => {
    res.render("index.ejs", { arr1: titleArr, arr2: contentArr, city: city, temperature: temperature, isLogged: isLogged, nickname: name, arr3: dateArr });
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.get("/logout", (req, res) => {
    isLogged = false;
    titleArr = [];
    contentArr = [];
    res.redirect("/");
});

async function makeArray(result1) {
    let newArr1 = [], newArr2 = [], newArr3 = [];

    for (let i = 0; i < result1.rows.length; i++) {
        newArr1.push(result1.rows[i].title);
        newArr2.push(result1.rows[i].content);

        // Format date here
        const dateObj = new Date(result1.rows[i].date);
        const formattedDate = `${dateObj.getDate()} ${getMonthName(dateObj.getMonth())} ${dateObj.getFullYear()}`;
        newArr3.push(formattedDate);
    }

    titleArr = newArr1;
    contentArr = newArr2;
    dateArr = newArr3;
}

function getMonthName(monthIndex) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[monthIndex];
}


app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    currUser = email;

    try {
        const result = await db.query("select password from users where email = $1", [email]);
        if (result.rows[0].password === password) {
            const result1 = await db.query("select content, title, date from content where email = $1", [email]);
            makeArray(result1);
            const result2 = await db.query("select nickname from users where email = $1", [email]);
            name = result2.rows[0].nickname;
            isLogged = true;
            res.redirect("/");
        } else {
            res.render("wrongpassword.ejs");
        }
    } catch (error) {
        res.render("nouserregister.ejs");
    }
});

app.post("/register", async (req, res) => {
    const { nickname, email, password } = req.body;
    try {
        var checkResult = await db.query("select * from users where email = $1", [email]);
        if (checkResult.rows.length > 0) {
            res.render("alreadyexistlogin.ejs");
        } else {
            currUser = email;
            await db.query("insert into users (nickname, email, password) values ($1, $2, $3)", [nickname, email, password]);
            isLogged = true;
            name = nickname;
            res.redirect("/");
        }
    } catch (error) {
        res.send("Unable to register please try again later");
    }
});

function getFormattedDate() {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const now = new Date();
    const dayOfMonth = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();

    return `${dayOfMonth} ${month} ${year}`;
}

app.post("/submit", async (req, res) => {
    if (!isLogged) {
        res.render("logintocontinue.ejs");
    } else {
        var date = getFormattedDate(); // Get the formatted date here
        const { title, content } = req.body;
        await db.query("insert into content (title, content, email, date) values ($1, $2, $3, $4)", [title, content, currUser, date]);
        let result1 = await db.query("select * from content where email = $1", [currUser]);
        makeArray(result1);
        res.redirect("/");
    }
});

app.post("/delete", async (req, res) => {
    const index = parseInt(req.body.index, 10);
    const title = titleArr[index];
    const content = contentArr[index];
    await db.query("delete from content where title = $1 and content = $2 and email = $3", [title, content, currUser]);
    let result1 = await db.query("select * from content where email = $1", [currUser]);
    makeArray(result1);
    res.redirect("/");
});

app.post("/edit", async (req, res) => {
    const index = parseInt(req.body.index, 10);
    const { title, content } = req.body;
    await db.query("update content set title = $1, content = $2 where email = $3", [title, content, currUser]);
    let result1 = await db.query("select * from content where email = $1", [currUser]);
    makeArray(result1);
    res.redirect("/");
});

app.post("/getTemp", async (req, res) => {
    city = req.body.city;
    const response = await axios.get(`http://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=5&appid=${API}`);
    const result = response.data;
    var latitude, longitude;
    if (result.length > 0) {
        latitude = result[0].lat;
        longitude = result[0].lon;
    }
    const response1 = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API}`);
    const result1 = response1.data;
    temperature = result1.main.temp;
    res.redirect("/");
});

app.listen(port, () => {
    console.log(`Listening on Port ${port}`);
});
