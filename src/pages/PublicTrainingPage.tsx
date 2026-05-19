import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Download, ExternalLink, FileText, Share2 } from "lucide-react";
import { toast } from "sonner";

const BROCHURE_URL =
  "https://bmhqsmygcnpekzdhtbed.supabase.co/storage/v1/object/public/training-docs/public/OECS_Brochure_v3.pdf";
const MANUAL_URL =
  "https://bmhqsmygcnpekzdhtbed.supabase.co/storage/v1/object/public/training-docs/public/OECS_User_Manual_v3.pdf";

const DOCS = [
  {
    title: "OECS Security Platform – Marketing Brochure",
    description:
      "Caribbean-themed overview of the SWM platform, featuring QuickBooks integration and multi-island payroll adaptability across the OECS region.",
    category: "Marketing",
    badge: "Latest v3",
    url: BROCHURE_URL,
    icon: BookOpen,
  },
  {
    title: "OECS Security Platform – User Manual",
    description:
      "Comprehensive guide covering scheduling, GPS attendance, payroll (NIC/PAYE), guard tours, voice reporting, invoicing, and more.",
    category: "Documentation",
    badge: "Latest v3",
    url: MANUAL_URL,
    icon: FileText,
  },
];

export default function PublicTrainingPage() {
  const handleShare = async (url: string, title: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch {
      // user cancelled or unsupported
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground text-sm">OE</span>
            </div>
            <div>
              <div className="font-bold text-foreground">OECS SWM Platform</div>
              <div className="text-xs text-muted-foreground">Training Hub</div>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/auth">
              Sign In <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <section className="text-center space-y-3">
          <Badge variant="secondary" className="mx-auto">Public Resources</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Training Hub
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Download the latest brochure and user manual for the Caribbean's most complete
            Security Workforce Management platform. Built for the OECS region with QuickBooks
            integration and multi-island payroll support.
          </p>
        </section>

        <section className="grid sm:grid-cols-2 gap-5">
          {DOCS.map((doc) => {
            const Icon = doc.icon;
            return (
              <Card key={doc.title} className="flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge>{doc.badge}</Badge>
                  </div>
                  <CardTitle className="text-lg leading-snug pt-2">{doc.title}</CardTitle>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    {doc.category}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                  <p className="text-sm text-muted-foreground">{doc.description}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button asChild className="flex-1">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" /> Download PDF
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleShare(doc.url, doc.title)}
                    >
                      <Share2 className="h-4 w-4 mr-2" /> Share
                    </Button>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline truncate"
                  >
                    {doc.url}
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="text-center py-8 border-t">
          <p className="text-sm text-muted-foreground">
            Want to see the platform in action?{" "}
            <a href="/auth" className="text-primary font-medium hover:underline">
              Sign in or request a demo →
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
