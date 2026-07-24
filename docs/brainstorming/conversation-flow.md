graph TD
    A["🎯 Start: Portfolio Monorepo<br/>React + Node + TypeScript"] --> B["Monorepo Tool Decision"]
    B --> B1["npm vs pnpm?"]
    B1 --> B2["✅ pnpm workspaces<br/>2-3x faster CI/CD"]
    
    A --> C["Deployment Strategy"]
    C --> C1["Local-only vs Cloud?"]
    C1 --> C2["✅ Hybrid: SaaS + Self-Hosted<br/>Same codebase, two modes"]
    
    C2 --> D["Authentication"]
    D --> D1["OAuth Providers?"]
    D1 --> D2["✅ Google, Microsoft, Facebook"]
    D --> D3["Account Linking?"]
    D3 --> D4["✅ Schema supports it from day 1<br/>UI deferred"]
    
    C2 --> E["Organizations"]
    E --> E1["Multi-org per user?"]
    E1 --> E2["❌ Single-org today<br/>Schema designed for multi-org later"]
    E --> E3["Admin Setup?"]
    E3 --> E4["✅ First login = auto-admin<br/>Setup wizard on first run"]
    
    C2 --> F["Database"]
    F --> F1["Database Strategy?"]
    F1 --> F2["✅ PostgreSQL agnostic<br/>Local Docker dev<br/>Azure prod SaaS"]
    F --> F3["Schema Migrations?"]
    F3 --> F4["❌ DACPAC<br/>✅ Prisma Migrate<br/>Git-tracked SQL files"]
    
    A --> G["Backend Framework"]
    G --> G1["Express vs Fastify?"]
    G1 --> G2["✅ Fastify<br/>2x faster<br/>TypeScript-first<br/>Plugin system"]
    
    G2 --> H["API Authorization"]
    H --> H1["JWT Protection Strategy?"]
    H1 --> H2["✅ Two-plugin pattern<br/>Public routes: no JWT<br/>Protected routes: JWT hook"]
    H --> H3["Token Strategy?"]
    H3 --> H4["✅ Access token 15min<br/>Refresh token in httpOnly cookie"]
    
    A --> I["Frontend & Styling"]
    I --> I1["Latest Versions?"]
    I1 --> I2["✅ React 19.x<br/>Vite 8.1.5<br/>TypeScript 7.0.2<br/>Tailwind 4.3.3"]
    I --> I3["Component Library?"]
    I3 --> I4["✅ Shadcn/ui<br/>Tailwind + Radix primitives"]
    
    C2 --> J["Infrastructure"]
    J --> J1["Deploy to Azure?"]
    J1 --> J2["IaC Tool: Bicep vs Terraform?"]
    J2 --> J3["✅ Terraform<br/>Modular modules<br/>dev/staging/prod environments"]
    J3 --> J4["Resources:<br/>PostgreSQL, App Service,<br/>Static Web App, Key Vault,<br/>Container Registry, VNet"]
    
    B2 --> K["✅ Tech Stack Locked"]
    D2 --> K
    D4 --> K
    E2 --> K
    E4 --> K
    F2 --> K
    F4 --> K
    G2 --> K
    H2 --> K
    H4 --> K
    I2 --> K
    I4 --> K
    J3 --> K
    J4 --> K
    
    K --> L["📄 Architecture Document<br/>Created: docs/brainstorming/"]
    L --> M["🔧 Terraform Stubs<br/>Created: infra/terraform/"]
    M --> N["✅ Ready for Monorepo Scaffolding"]
    
    style A fill:#e1f5ff
    style K fill:#c8e6c9
    style N fill:#c8e6c9
    style B2 fill:#a5d6a7
    style C2 fill:#a5d6a7
    style D2 fill:#a5d6a7
    style D4 fill:#a5d6a7
    style E2 fill:#a5d6a7
    style E4 fill:#a5d6a7
    style F2 fill:#a5d6a7
    style F4 fill:#a5d6a7
    style G2 fill:#a5d6a7
    style H2 fill:#a5d6a7
    style H4 fill:#a5d6a7
    style I2 fill:#a5d6a7
    style I4 fill:#a5d6a7
    style J3 fill:#a5d6a7
