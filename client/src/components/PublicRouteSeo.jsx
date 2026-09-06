import { useLocation } from "react-router-dom";
import Seo from "./Seo";

const ROUTES = {
    "/": {
        title: "CompanionAI | AI Interview Practice & Technical Hiring",
        description: "Practice realistic software engineering interviews or run structured technical assessments with adaptive questioning, coding, system design, and evidence-led human review.",
        schema: "WebSite",
    },
    "/practice": {
        title: "AI Technical Interview Practice for Software Engineers | CompanionAI",
        description: "Practice role-specific software engineering interviews with adaptive follow-ups, coding rounds, system design, resume context, and evidence-backed feedback.",
        schema: "EducationalApplication",
    },
    "/hire": {
        title: "Structured Technical Hiring & AI Candidate Assessments | CompanionAI",
        description: "Create structured engineering assessments, invite candidates, run adaptive technical interviews, and review evidence-rich scorecards with human-controlled hiring decisions.",
        schema: "BusinessApplication",
    },
    "/docs": {
        title: "CompanionAI Documentation | Interview Practice & Technical Hiring",
        description: "Learn how CompanionAI interview practice, technical assessments, system design discussions, scorecards, security controls, and hiring workflows work.",
        schema: "WebPage",
    },
    "/docs/technical-hiring/structured-technical-assessments": {
        title: "Structured Technical Assessments | CompanionAI Docs",
        description: "Design structured technical assessments with role-specific rounds, adaptive interviews, candidate invitations, and evidence-led recruiter review.",
        schema: "TechArticle",
    },
    "/docs/technical-hiring/system-design-interviews": {
        title: "System Design Interviews with Live AI Discussion | CompanionAI Docs",
        description: "See how CompanionAI combines an Excalidraw architecture canvas, live interviewer prompts, candidate discussion, and human-reviewed system design evidence.",
        schema: "TechArticle",
    },
    "/docs/technical-hiring/interview-scorecards": {
        title: "Technical Interview Scorecards & Calibration | CompanionAI Docs",
        description: "Use weighted competencies, evidence-rich scorecards, human overrides, and calibration workflows for more consistent technical hiring reviews.",
        schema: "TechArticle",
    },
    "/docs/candidates/ai-interview-practice": {
        title: "AI Interview Practice for Software Engineers | CompanionAI Docs",
        description: "Prepare for conversational, coding, and system design interviews with role context, adaptive questioning, and post-interview feedback.",
        schema: "TechArticle",
    },
    "/docs/security/human-review-and-integrity-signals": {
        title: "Human Review, Integrity Signals & Candidate Privacy | CompanionAI Docs",
        description: "Understand CompanionAI candidate privacy, consented integrity signals, human-only interpretation, and safeguards around AI-assisted hiring evidence.",
        schema: "TechArticle",
    },
    "/docs/hiring/oidc-sso": {
        title: "OIDC SSO for Hiring Organizations | CompanionAI Docs",
        description: "Configure organization OIDC single sign-on for CompanionAI Hire with secure client-secret storage and enterprise access controls.",
        schema: "TechArticle",
    },
    "/privacy": {
        title: "Privacy Notice | CompanionAI",
        description: "Read how CompanionAI handles account data, resumes, interview answers, candidate assessments, AI processing, integrity signals, retention, and deletion.",
        schema: "WebPage",
    },
    "/terms": {
        title: "Terms of Use | CompanionAI",
        description: "Read the CompanionAI terms for interview practice, technical assessments, acceptable use, AI limitations, account use, and user-submitted content.",
        schema: "WebPage",
    },
};

export const seoForPath = (pathname) => {
    if (ROUTES[pathname]) return { ...ROUTES[pathname], canonicalPath: pathname };
    if (pathname.startsWith("/docs/")) return { ...ROUTES["/docs"], canonicalPath: pathname };
    return null;
};

const structuredDataFor = (config, canonicalUrl) => {
    const common = {
        "@context": "https://schema.org",
        name: config.title,
        description: config.description,
        url: canonicalUrl,
    };
    if (config.schema === "EducationalApplication" || config.schema === "BusinessApplication") {
        return {
            ...common,
            "@type": "SoftwareApplication",
            applicationCategory: config.schema,
            operatingSystem: "Web",
            publisher: { "@type": "Organization", name: "CompanionAI" },
        };
    }
    if (config.schema === "WebSite") {
        return {
            "@context": "https://schema.org",
            "@graph": [
                { "@type": "WebSite", name: "CompanionAI", description: config.description, url: canonicalUrl },
                { "@type": "Organization", name: "CompanionAI", url: canonicalUrl },
            ],
        };
    }
    return { ...common, "@type": config.schema || "WebPage", publisher: { "@type": "Organization", name: "CompanionAI" } };
};

export default function PublicRouteSeo() {
    const { pathname } = useLocation();
    const config = seoForPath(pathname);
    if (!config) return null;
    const configuredOrigin = String(import.meta.env.VITE_PUBLIC_ORIGIN || "").trim();
    let origin = window.location.origin;
    try { if (configuredOrigin) origin = new URL(configuredOrigin).origin; } catch { /* use current origin */ }
    const canonicalUrl = new URL(config.canonicalPath, `${origin}/`).href;
    return (
        <Seo
            title={config.title}
            description={config.description}
            canonicalPath={config.canonicalPath}
            structuredData={structuredDataFor(config, canonicalUrl)}
        />
    );
}
