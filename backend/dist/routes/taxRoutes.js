"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taxController_1 = require("../controllers/taxController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware); // Tất cả API thuế cần đăng nhập
router.post('/calculate', taxController_1.calculateTax);
router.post('/declarations', taxController_1.saveDeclaration);
router.get('/declarations', taxController_1.getDeclarations);
exports.default = router;
