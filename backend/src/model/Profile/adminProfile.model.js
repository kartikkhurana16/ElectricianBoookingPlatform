import mongoose from "mongoose";

// Admin profile. Login details (email, password, 2FA) live in auth/admin.auth.model.js
const adminProfileSchema = new mongoose.Schema({
    auth: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
            unique: true
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        avatar: {
            type: String
        }, // image URL
        coverImage: {
            type: String
        },
        address:{
            type:String,
        },
        addressType: {
            type: String,
            enum: ["Home", "Office", "Other"],
            default: "Home"
        },
        houseNumber: {
            type: String,
            trim: true
        },
        landmark: {
            type: String,
            trim: true
        },
        city: {
            type: String,
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        pincode: {
            type: String,
            trim: true
        },
        date_of_birth:{
            type:Date
        }
}, { timestamps: true })

export const AdminProfile = mongoose.model("AdminProfile", adminProfileSchema)
