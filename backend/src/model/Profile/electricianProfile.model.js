import mongoose from "mongoose";
import { randomInt } from "node:crypto";

// Services an electrician can offer. Also used by ElectricianJob.serviceType.
export const ELECTRICIAN_SKILLS = [
    "wiring",
    "switch_socket",
    "fan_installation",
    "light_fitting",
    "inverter_ups",
    "ac_installation",
    "appliance_repair",
    "mcb_db_repair",
    "earthing",
    "meter_installation",
    "cctv_installation",
    "solar_installation",
    "short_circuit_repair",
    "general_inspection",
];

// ID cards / KYC documents uploaded by the electrician
const idCardSchema = new mongoose.Schema({
    cardType: {
        type: String,
        enum: ["aadhaar", "pan", "voter_id", "driving_license", "electrical_license", "other"],
        required: true
    },
    cardNumber: {
        type: String,
        trim: true,
        select: false
    },
    frontImage: {
        type: String,
        required: true
    }, // image URL
    backImage: {
        type: String
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    rejectionReason: {
        type: String
    },
    verifiedAt: {
        type: Date
    },
}, { timestamps: true });

const electricianProfileSchema = new mongoose.Schema({

    // ---------- Identity ----------
    auth: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ElectricianAuth",
        required: true,
        unique: true
    }, // phone, email, password live here
    electricianId: {
        type: String,
        unique: true,
        uppercase: true,
        trim: true
    }, // human-readable id e.g. ELE-482913, auto-generated
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    gender: {
        type: String,
        enum: ["male", "female", "other"]
    },
    dateOfBirth: {
        type: Date
    },
    avatar: {
        type: String
    }, // image URL
    bio: {
        type: String,
        trim: true,
        maxlength: 500
    },

    // ---------- Work ----------
    experienceYears: {
        type: Number,
        min: 0,
        max: 60,
        default: 0
    },
    skills: {
        type: [{ type: String, enum: ELECTRICIAN_SKILLS }],
        default: []
    },
    visitingCharge: {
        type: Number,
        min: 0,
        default: 0
    }, // base inspection fee in INR

    // ---------- Address ----------
    address: {
        line1: { type: String, trim: true },
        line2: { type: String, trim: true },
        landmark: { type: String, trim: true },
        city: { type: String, trim: true, index: true },
        state: { type: String, trim: true },
        pincode: {
            type: String,
            match: [/^\d{6}$/, "Enter a valid 6-digit pincode"]
        },
    },
    // GeoJSON point for "electricians near me", coordinates are [longitude, latitude]
    location: {
        type: {
            type: String,
            enum: ["Point"]
        },
        coordinates: {
            type: [Number],
            default: undefined,
            validate: [(v) => !v || v.length === 2, "Coordinates must be [lng, lat]"]
        },
    },

    // ---------- Availability ----------
    // No fixed off days: the electrician switches this on/off whenever they want work.
    // Customers and admins can only assign jobs while it is true.
    isAvailable: {
        type: Boolean,
        default: false,
        index: true
    },
    availabilityUpdatedAt: {
        type: Date
    },

    // ---------- ID cards / verification ----------
    idCards: {
        type: [idCardSchema],
        default: []
    },
    verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected", "suspended"],
        default: "pending",
        index: true
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdminAuth"
    },
    verifiedAt: {
        type: Date
    },

    // ---------- Payment details ----------
    upiDetails: {
        type: new mongoose.Schema({
            upiId: {
                type: String,
                trim: true,
                lowercase: true,
                match: [/^[\w.-]{2,256}@[a-z]{2,64}$/, "Enter a valid UPI id"]
            },
            upiName: { type: String, trim: true }, // name registered with UPI
            qrCodeImage: { type: String }, // image URL
        }, { _id: false }),
        select: false
    }, // never returned by default

    // ---------- Earnings summary (kept in sync by ElectricianJob) ----------
    commissionPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: 15
    }, // platform cut per job
    totalEarnings: {
        type: Number,
        default: 0
    }, // lifetime money earned after commission
    pendingPayout: {
        type: Number,
        default: 0
    }, // earned but not yet paid out
    totalPaidOut: {
        type: Number,
        default: 0
    },
    totalJobs: {
        type: Number,
        default: 0
    },
    completedJobs: {
        type: Number,
        default: 0
    },

    // ---------- Rating ----------
    rating: {
        average: { type: Number, min: 0, max: 5, default: 0 },
        count: { type: Number, min: 0, default: 0 },
    },

}, { timestamps: true });

electricianProfileSchema.index({ location: "2dsphere" });

electricianProfileSchema.pre("validate", function () {
    if (!this.electricianId) {
        this.electricianId = `ELE-${randomInt(100000, 1000000)}`;
    }
    if (this.isModified("isAvailable")) {
        this.availabilityUpdatedAt = new Date();
    }
});

// Can a customer/admin assign a job to this electrician?
electricianProfileSchema.methods.canBeAssigned = function () {
    return this.isAvailable && this.verificationStatus === "verified";
};

// Verified + available electricians near the customer. lng/lat are the customer's coordinates.
electricianProfileSchema.statics.findAvailableNearby = function ({ lng, lat, skill, maxDistanceKm = 15, limit = 20 }) {
    const query = {
        isAvailable: true,
        verificationStatus: "verified",
        location: {
            $near: {
                $geometry: { type: "Point", coordinates: [lng, lat] },
                $maxDistance: maxDistanceKm * 1000,
            },
        },
    };
    if (skill) query.skills = skill;

    return this.find(query).limit(limit);
};

export const ElectricianProfile = mongoose.model("ElectricianProfile", electricianProfileSchema);
