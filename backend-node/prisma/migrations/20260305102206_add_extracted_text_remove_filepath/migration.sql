-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "extracted_text" TEXT,
ALTER COLUMN "file_path" DROP NOT NULL;
