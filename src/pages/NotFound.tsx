import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 bg-background">
      <BrandLogo size="md" />
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-heading font-bold">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary font-medium underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
