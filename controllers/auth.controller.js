const User = require("../models/user.model");
const Otp = require("../models/otp.model");
const authUtil = require("../util/authentication");
const validation = require("../util/validation");
const sessionFlash = require("../util/session-flash");
const nodemailer = require("nodemailer");
require("dotenv").config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.VERIFICATION_SENDER, // Your email address
    pass: process.env.VERIFICATION_PASS, // app-specific password
  },
});

function getSignup(req, res) {
  let sessionData = sessionFlash.getSessionData(req);

  if (!sessionData) {
    sessionData = {
      email: "",
      confirmEmail: "",
      password: "",
      fullname: "",
      street: "",
      postal: "",
      city: "",
    };
  }

  res.render("customer/auth/signup", { inputData: sessionData });
}

async function signup(req, res, next) {
  const enteredData = {
    email: req.body.email,
    confirmEmail: req.body["confirm-email"],
    password: req.body.password,
    fullname: req.body.fullname,
    street: req.body.street,
    postal: req.body.postal,
    city: req.body.city,
  };

  if (
    !validation.userDetailsAreValid(
      req.body.email,
      req.body.password,
      req.body.fullname,
      req.body.street,
      req.body.postal,
      req.body.city
    ) ||
    !validation.emailIsConfirmed(req.body.email, req.body["confirm-email"])
  ) {
    sessionFlash.flashDataToSession(
      req,
      {
        errorMessage:
          "Please check your input. Password must be at least 6 character slong, postal code must be 5 characters long.",
        ...enteredData,
      },
      function () {
        res.redirect("/signup");
      }
    );
    return;
  }

  const user = new User(
    req.body.email,
    req.body.password,
    req.body.fullname,
    req.body.street,
    req.body.postal,
    req.body.city
  );

  try {
    const existsAlready = await user.existsAlready();

    if (existsAlready) {
      sessionFlash.flashDataToSession(
        req,
        {
          errorMessage: "User exists already! Try logging in instead!",
          ...enteredData,
        },
        function () {
          res.redirect("/signup");
        }
      );
      return;
    }

    await user.signup(); // Save user to database
    await sendVerificationEmail(req.body.email);
  } catch (error) {
    next(error);
    return;
  }

  res.redirect("/verify");
}

function getLogin(req, res) {
  let sessionData = sessionFlash.getSessionData(req);

  if (!sessionData) {
    sessionData = {
      email: "",
      password: "",
    };
  }

  res.render("customer/auth/login", { inputData: sessionData });
}

async function login(req, res, next) {
  const user = new User(req.body.email, req.body.password);
  let existingUser;
  try {
    existingUser = await user.getUserWithSameEmail();
  } catch (error) {
    next(error);
    return;
  }
  const userIsVerified = existingUser && existingUser.verified;
  const sessionErrorData = {
    errorMessage: !existingUser
      ? "Invalid email or password. Please try again."
      : !userIsVerified
      ? "Please verify your email first."
      : "Invalid email or password. Please try again.",
    email: user.email,
    password: user.password,
  };

  if (!userIsVerified) {
    sessionFlash.flashDataToSession(req, sessionErrorData, function () {
      sendVerificationEmail(req.body.email);
      res.redirect("/verify");
    });
    return;
  }

  const passwordIsCorrect = await user.hasMatchingPassword(
    existingUser.password
  );

  if (!passwordIsCorrect) {
    sessionFlash.flashDataToSession(req, sessionErrorData, function () {
      res.redirect("/login");
    });
    return;
  }

  authUtil.createUserSession(req, existingUser, function () {
    res.redirect("/");
  });
}

function logout(req, res) {
  authUtil.destroyUserAuthSession(req);
  res.redirect("/login");
}

function getVerify(req, res) {
  let sessionData = sessionFlash.getSessionData(req);

  if (!sessionData) {
    sessionData = {
      errorMessage: "",
      email: "",
      otp: "",
    };
  }

  res.render("customer/auth/verify", { inputData: sessionData });
}

async function verify(req, res) {
  const email = req.body.email;
  const otp = req.body.otp;
  try {
    const result = await Otp.verifyOtp(email, otp); // will throw error if something is wrong
    await User.verifyUser(email);
    res.redirect("/login");
  } catch (err) {
    sessionFlash.flashDataToSession(
      req,
      {
        errorMessage: err.message || "Invalid OTP. Please try again.",
        email: email,
        otp: otp,
      },
      function () {
        res.redirect("/verify");
      }
    );
  }
}

const sendVerificationEmail = async (email) => {
  try {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const mailOptions = {
      from: process.env.VERIFICATION_SENDER,
      to: email,
      subject: "Verify your email - Next Tech Mart", // Subject line
      text: `Welcome to Next Tech Mart! Your verification code is ${otp}. Enter it in the app to verify your email. The code is valid for 10 minutes.`,
    };
    const newOtp = new Otp(
      email,
      otp,
      new Date(),
      new Date(Date.now() + 600000)
    );
    await newOtp.saveOtp();
    const info = await transporter.sendMail(mailOptions);

    console.log(info);
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  getVerify: getVerify,
  verify: verify,
  getSignup: getSignup,
  getLogin: getLogin,
  signup: signup,
  login: login,
  logout: logout,
};
