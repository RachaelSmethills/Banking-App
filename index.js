const express = require("express");
var nodemailer = require("nodemailer");
const app = express();
const mongoose = require("mongoose");
const sessionCheck = require("./middleware/sessioncheck");
const Handlebars = require("handlebars");
const User = require("./models/user");
var uuid = require("uuid");
const { auth } = require("express-openid-connect");
const {
  allowInsecurePrototypeAccess,
} = require("@handlebars/allow-prototype-access");
const expressHandlebars = require("express-handlebars");
require("dotenv").config(".env");

const openIdConfig = {
  authRequired: false,
  auth0Logout: true,
  secret: "a long, randomly-generated string stored in env",
  baseURL: "http://localhost:3001",
  clientID: process.env.AUTH0_CLIENTID,
  issuerBaseURL: process.env.AUTH0_DOMAIN,
};

const transport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "rachael.skywork@gmail.com",
    pass: process.env.GMAIL_PASSWORD,
  },
});

mongoose.connection.on("connecting", () => {
  console.log("Doing my best..");
});

mongoose.connection.on("connected", () => {
  console.log("connected to mongodb");
});

mongoose.connect(
  "mongodb+srv://user:Pa55word1@cluster0.s0rwr.mongodb.net/test",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

app.use(auth(openIdConfig));
app.use(sessionCheck);

const handlebars = expressHandlebars({
  handlebars: allowInsecurePrototypeAccess(Handlebars),
});

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.engine("handlebars", handlebars);
app.set("view engine", "handlebars");

function addTransaction(amount, from) {
  return {
    amount: amount,
    from: from,
    date: new Date(),
  };
}

// app.get('/login') this is created by express-openid-connect and displays a login widget
// app.get('/callback') this is created by express-openid-connect and fetches an authenticated user their token
// app.get('/logout') this is created by express-openid-connect and will end a users token based session

app.get("/", async (req, res) => {
  let user = await User.findOne({ username: req.oidc.user.email });

  if (!user) {
    user = new User({
      username: req.oidc.user.email,
      balance: 1000,
    });

    user.save().then((data) => {
      console.log("Acccount Created");
    });
  }

  const requests = await User.find({
    "friends.name": req.oidc.user.email,
    "friends.pending": true,
  });

  console.log("Pending", requests);

  res.render("index", {
    user: user,
    friends: user.friends,
    pendingRequests: requests,
  });
});

app.post("/deposit", async (req, res) => {
  console.log("Details provided", req.body);
  const { deposit } = req.body;
  let user = await User.findOne({ username: req.oidc.user.email });
  user.balance = parseFloat(deposit) + parseFloat(user.balance);
  user.transactions.push(addTransaction(deposit, "Deposit"));
  user.save().then((data) => {
    console.log("Balance Updated");
    res.redirect(req.headers.referer);
  });
});

app.post("/friend/pay", async (req, res) => {
  console.log("Details provided", req.body);
  const { amount, name } = req.body;
  console.log("body", req.body);
  let user = await User.findOne({ username: req.oidc.user.email });
  user.balance = parseFloat(user.balance) - parseFloat(amount);
  user.transactions.push(addTransaction(amount, "Money Sent - " + name));
  await user.save();

  let friend = await User.findOne({ username: name });
  friend.balance = parseFloat(friend.balance) + parseFloat(amount);
  friend.transactions.push(
    addTransaction(amount, "Money Received - " + req.oidc.user.email)
  );
  await friend.save();

  res.redirect(req.headers.referer);
});

app.get("/friend/accept/:id", async (req, res) => {
  User.findOneAndUpdate(
    { username: req.oidc.user.email, "friends.validation": req.params.id },
    {
      $set: {
        "friends.$.pending": false,
      },
    },
    async function (error, doc) {
      if (!error && !!doc) {
        console.log("Mates rates now", doc);
        let request = await User.findOne({ username: doc.friends[0].name });
        request.friends.push({ name: req.oidc.user.email, pending: false });
        await request.save();
      }

      res.redirect("/");
    }
  );
});

app.post("/friend", async (req, res) => {
  console.log("Details provided", req.body);
  const { email } = req.body;
  let user = await User.findOne({ username: email });
  if (!user) {
    user = new User({
      username: email,
      balance: 1000,
    });
  }

  const randomId = uuid.v4();
  user.friends.push({
    name: req.oidc.user.email,
    validation: randomId,
    pending: true,
  });

  await user.save();

  const emailConfig = {
    from: user.username,
    to: email,
    subject: "Friend request",
    html: `Hi man,<br/><br/>I would like to invite you to be my friend<br/><br/><a style="text-decoration:none;padding:15px;background-color:green;color:white;border-radius:3px;" href="${process.env.BASE_URL}/friend/accept/${randomId}">Accept Request</a>`,
    replyto: "no-reply@banking-app.com",
  };

  transport.sendMail(emailConfig, (err, result) => {
    console.log(err || result);
    res.redirect(req.headers.referer);
  });
});

app.listen(3001, () => {
  console.log("running on http://localhost:3001");
  console.log("Working with: ", process.env.AUTH0_DOMAIN);
});
