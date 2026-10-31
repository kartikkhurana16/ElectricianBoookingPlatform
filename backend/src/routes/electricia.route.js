import { Router } from "express";
import {
    electricianRegister,
    electricianLogin,
    electricianLogout,
    changeElectricianPassword,
    refreshElectricianToken,
    getCurrentElectrician,
    electricianForgotPassword,
    electricianResetPassword

} from "../controller/electrician.controller.js"
import { verifyJWT,allowRoles } from "../middleware/auth.middleware.js";

const electricianRouter=Router();

electricianRouter.route("/register").post(electricianRegister);
electricianRouter.route("/login").post(electricianLogin);electricianRouter.route("/logout").post(verifyJWT, allowRoles("electrician"), electricianLogout);
electricianRouter.route("/change-password").patch(verifyJWT, allowRoles("electrician"), changeElectricianPassword);
electricianRouter.route("/current-user").get(verifyJWT, allowRoles("electrician"), getCurrentElectrician);
electricianRouter.route("/refresh-token").post(refreshElectricianToken);
electricianRouter.route("/forgot-password").post(electricianForgotPassword);
electricianRouter.route("/reset-password").post(electricianResetPassword);


export default electricianRouter;
