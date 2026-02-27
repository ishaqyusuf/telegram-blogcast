import BlogHome from "@/screens/blog-home";
// import BlogHomeLegacy from "@/screens.example/blog-home";
// import BlogHome2 from "@/screens.example/blog-home2";

export default function Home() {
  //   return <Redirect href={"/home2"} />;
  // Old blog page switcher:
  // return (
  //   <DesignSwitch
  //     screen
  //     screens={[<BlogHomeLegacy key={0} />, <BlogHome2 key={1} />]}
  //   />
  // );
  return <BlogHome />;
}
