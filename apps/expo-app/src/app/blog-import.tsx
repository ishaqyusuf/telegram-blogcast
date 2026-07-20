import { LocalServicesGuard } from "@/components/local-services";
import BlogImportScreen from "@/screens/blog-import-screen";

export default function Page() {
  return (
    <LocalServicesGuard>
      <BlogImportScreen />
    </LocalServicesGuard>
  );
}
