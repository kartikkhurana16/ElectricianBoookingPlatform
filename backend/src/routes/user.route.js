import { Router } from "express";
import {
    userRegister, 
    userLogin,
    userLogout,
    changeUserPassword,
    refreshTokenAccess,
    getCurrentUser,
    forgotPassword,
    resetPassword

} from "../controller/user.controller.js"
import { verifyJWT } from "../middleware/auth.middleware.js";

const router=Router();

router.route("/register").post(userRegister);
router.route("/login").post(userLogin);
router.route("/logout").post(verifyJWT,userLogout);
router.route("/change-password").patch(verifyJWT,changeUserPassword);
router.route("/refresh-token").post(refreshTokenAccess);
router.route("/current-user").get(verifyJWT,getCurrentUser);
router.route("/forgot-password").post(forgotPassword);
router.route("/reset-password").post(resetPassword);



export default router;
