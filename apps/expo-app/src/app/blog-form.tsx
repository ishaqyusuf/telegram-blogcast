import { DesignSwitch } from "@/components/design-switch";
import BlogFormScreen from "@/screens.example/blog-form-screen";

export default function Page() {
  // return <NewBlogScreen key={0} />;
  return (
    <DesignSwitch
      screens={[
        <BlogFormScreen key={0} />,
        // <NewBlogScreen key={0} />
      ]}
    />
  );
}
