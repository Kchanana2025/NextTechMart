const bcrypt = require("bcryptjs");
const mongodb = require("mongodb");

const db = require("../data/database");

class Otp {
  constructor(userEmail, otp, createdAt, expiresAt) {
    this.userEmail = userEmail;
    this.otp = otp;
    this.createdAt = createdAt;
    this.expiresAt = expiresAt;
  }

  static async verifyOtp(userEmail, otp) {
    try {
      const query = { userEmail: userEmail };
      const otpDoc = await db.getDb().collection("otp").findOne(query);

      if (!otpDoc) {
        throw new Error("Account does not exist or already verified.");
      }

      const isMatch = await bcrypt.compare(otp, otpDoc.otp);
      if (!isMatch) {
        throw new Error("Invalid OTP. Please try again.");
      }

      if (otpDoc.expiresAt < new Date()) {
        await db.getDb().collection("otp").deleteOne(query);
        throw new Error("OTP has expired. Please try signing up again.");
      }

      // OTP is valid and not expired- delete the OTP document
      await db.getDb().collection("otp").deleteOne(query);
      return true;
    } catch (error) {
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  async saveOtp() {
    const hashedOtp = await bcrypt.hash(this.otp, 12);
    await db.getDb().collection("otp").insertOne({
      userEmail: this.userEmail,
      otp: hashedOtp,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
    });
  }
}

module.exports = Otp;
