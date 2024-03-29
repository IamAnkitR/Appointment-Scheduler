/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const express = require("express");
const app = express();
const path = require("path");

const { Admin, Appointment } = require("./models");
const bcrypt = require("bcrypt");
var cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const localStrategy = require("passport-local");
const passport = require("passport");
const flash = require("connect-flash");
const { exit } = require("process");

const saltRounds = 10;

app.use(flash());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("ssh! some secret string!"));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "this is a secret",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    }
  })
);

app.use(function (req, res, next) {
  res.locals.messages = req.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new localStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      Admin.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Entered password is wrong" });
          }
        })
        .catch((error) => {
          console.log(error);
          return done(null, false, {
            message: "Please register first",
          });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("Serializing user in session", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  Admin.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});


app.get("/", (req, res) => {
  if (req.user) {
    return res.redirect("/appointment");
  } else {
    return res.render("index", {
      title: "Application Scheduler"
    });
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
})

app.get("/signin", (req, res) => {
  res.render("signin");
})

app.get(
  "/index",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const loggedInAdminID = req.user.id;

    const admin = await Admin.findByPk(loggedInAdminID);
    res.render("home", { username: admin.name });
  }
);

app.post("/users", async (req, res) => {
  if (req.body.email.length == 0) {
    req.flash("error", "Email can not be empty!");
    return res.redirect("/signup");
  }

  if (req.body.name.length == 0) {
    req.flash("error", "Name can not be empty!");
    return res.redirect("/signup");
  }
  if (req.body.password.length < 8) {
    req.flash("error", "Enter a strong password with length 8 or more");
    return res.redirect("/signup");
  }
  const hashpwd = await bcrypt.hash(req.body.password, saltRounds);
  try {
    const user = await Admin.create({
      name: req.body.name,
      email: req.body.email,
      password: hashpwd,
    });
    req.login(user, (err) => {
      if (err) {
        console.log(err);
        res.redirect("/");
      } else {
        req.flash("success", "Sign up successful");
        res.redirect("/appointment");
      }
    });
  } catch (error) {
    req.flash("error", "This email is already registered");
    return res.redirect("/signup");
  }
});

app.get("/signout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    } else {
      res.redirect("/");
    }
  });
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/signin",
    failureFlash: true,
  }),
  function (req, res) {
    console.log(req.user);
    res.redirect("/appointment");
  }
);

let startArray = [];
let endArray = [];
app.get(
  "/appointment",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const loggedInUser = req.user.id;
    const user = await Admin.findByPk(loggedInUser);
    const userName = user.dataValues.name;
    const appointmentList = await Appointment.getAppointments(loggedInUser);
    for (let i = 0; i < appointmentList.length; i++) {
      startArray.push(appointmentList[i].start);
      endArray.push(appointmentList[i].end);
    }

    if (req.accepts("html")) {
      res.render("home", {
        userName,
        appointmentList,
      });
    } else {
      res.json({ userName, appointmentList });
    }
  }
);



app.post(
  "/appointments",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    let startTime = req.body.start;
    let endTime = req.body.end;
   
    try {
      
      await Appointment.addAppointment({
        title: req.body.title,
        date: req.body.date,
        start: req.body.start,
        end: req.body.end,
        adminId: req.user.id,
      });
      res.redirect("/appointment");
    } catch (error) {
      console.log(error);
      return res.status(422).json(error);
    }
  }
);

app.get("/appointments/:id", async function (req, res) {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    return res.json(appointment);
  } catch (error) {
    console.log(error);
    return res.status(422).json(error);
  }
});

app.delete(
  "/appointments/:id/delete",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const response = await Appointment.deleteAppointment(req.params.id);
      return res.json({ success: response === 1 });
    } catch (error) {
      console.log(error);
      return res.status(422).json(error);
    }
  }
);

app.get(
  "/appointments/:id/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const loggedInUser = req.user.id;
    const user = await Admin.findByPk(loggedInUser);
    const userName = user.dataValues.name;
    const appointment = await Appointment.findByPk(req.params.id);
    console.log(appointment);
    res.render("edit", {
      userName: userName,
      appointment: appointment,
      id: req.params.id,
    });
  }
);


app.post(
  "/appointments/:id/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const appointment = await Appointment.findByPk(req.params.id);
      await Appointment.editAppointment({
        id: appointment.id,
        title: req.body.title,
      });
      res.redirect("/appointment");
    } catch (error) {
      console.log(error);
      return;
    }
  }
);

module.exports = app;