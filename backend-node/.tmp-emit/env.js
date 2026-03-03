"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string(),
    DIRECT_URL: zod_1.z.string(),
    ANTHROPIC_API_KEY: zod_1.z.string().default(''),
    PORT: zod_1.z.string().default('8000'),
    UPLOAD_DIR: zod_1.z.string().default('uploads'),
    CORS_ORIGIN: zod_1.z.string().optional(),
    NODE_ENV: zod_1.z.string().default('development'),
});
exports.env = envSchema.parse(process.env);
