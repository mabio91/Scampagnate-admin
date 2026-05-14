import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { AuthPageWrapper } from "@/components/AuthPageWrapper";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").then(({ data: roles }) => {
          if (roles?.length) {
            navigate("/");
            return;
          }
          setCheckingAuth(false);
        });
      } else {
        setCheckingAuth(false);
      }
    });
  }, [navigate]);

  useEffect(() => {
    const saved = localStorage.getItem("rememberedEmail");
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_status")
        .eq("id", data.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.account_status === "Suspended" || profile.account_status === "Banned") {
        await supabase.auth.signOut();
        toast.error(`Access denied. Your account is ${profile.account_status.toLowerCase()}.`);
        return;
      }

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
      if (!roles?.length) {
        await supabase.auth.signOut();
        toast.error("Access denied. Admin role required.");
        return;
      }
      navigate("/");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthPageWrapper>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <Card className="w-full max-w-sm border-border/50 shadow-xl backdrop-blur-sm bg-card/80">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-fit mb-2">
            <img src={logo} alt="Logo" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl tracking-tight">{t("login.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("common.email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/60" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("users.password")}</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background/60 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">{t("login.rememberMe")}</Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("login.signingIn")}</> : t("login.signIn")}
            </Button>
            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("login.forgotPassword")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthPageWrapper>
  );
}
