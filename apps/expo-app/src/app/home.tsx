import { DesignSwitch } from "@/components/design-switch";
import BlogHome from "@/screens.example/blog-home";
import BlogHome2 from "@/screens.example/blog-home2";
import { Redirect } from "expo-router";

export default function Home() {
  //   return <Redirect href={"/home2"} />;
  // return <BlogHome />;
  return (
    <DesignSwitch
      screen
      screens={[<BlogHome key={0} />, <BlogHome2 key={1} />]}
    />
  );
}
