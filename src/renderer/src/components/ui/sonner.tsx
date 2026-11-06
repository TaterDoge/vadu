import { useTheme } from "@renderer/lib/theme";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps): React.ReactNode {
  const { resolved } = useTheme();

  return <Sonner richColors theme={resolved} {...props} />;
}

export { Toaster };
