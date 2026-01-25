import { redirect } from "next/navigation";
import { Upload } from "lucide-react";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

export default function ImportPage() {
  if (!adminEnabled) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Import</h1>
        <p className="text-gray-500">Kommer snart</p>
      </div>
    </div>
  );
}
