import mongoose from "mongoose";

const verificationSchema = new mongoose.Schema({

    identifier: {
        type: String,
        required: true,
        trim: true
    },

    type: {
        type: String,
        enum: ["email", "phone"],
        required: true
    },

    verificationCode: {
        type: String,
        required: true,
        select: false
    },

    verificationCodeExpiry: {
        type: Date,
        required: true,
        index: { expires: 0 }
    },

    attempts: {
        type: Number,
        default: 0
    },

    isVerified: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

verificationSchema.index(
    { identifier: 1, type: 1 },
    { unique: true }
);

export const Verification = mongoose.model("Verification",verificationSchema);