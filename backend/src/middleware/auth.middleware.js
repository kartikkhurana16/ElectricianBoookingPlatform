import { User } from "../model/auth/user.auth.model.js";
import { Electrician } from "../model/auth/electrician.auth.model.js"

import { ApiError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const MODEL_BY_ROLE = {
    customer: User,
    electrician: Electrician,
};

export const verifyJWT = asyncHandler(async (req, res, next) => {
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    let decodedToken;

    try {
        decodedToken = jwt.verify(
            token,
            process.env.ACCESS_TOKEN_SECRET
        );
    } catch (error) {
        throw new ApiError(401, "Invalid or expired access token");
    }
    const role=decodedToken?.role;
    const Model=MODEL_BY_ROLE[role];
    
 if (!Model) {
        throw new ApiError(401, "User not found or invalid access token");
    }
    const account = await Model.findById(decodedToken?._id)
        .select("-password -refreshToken");

    if (!account) {
        throw new ApiError(401, "User not found or invalid access token");
    }

    req.user = account;
    req.role=role;
    next();
});
export const allowRoles = (...roles) => {
    return (req, res, next) => {

        if (!roles.includes(req.role)) {
            throw new ApiError(403, "Access denied");
        }

        next();
    };
};