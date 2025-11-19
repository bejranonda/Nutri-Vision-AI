# Regulatory & Compliance Requirements

**Last Updated:** November 17, 2025

## Overview

Navigating regulatory requirements is critical for NutriVision AI's success and risk mitigation. This document outlines key regulatory considerations for digital health applications in Thailand and Southeast Asia.

---

## 1. Thailand Regulations

### A. Personal Data Protection Act (PDPA)

#### Overview
- **Effective Date**: June 1, 2022
- **Regulator**: Personal Data Protection Committee (PDPC)
- **Model**: Based heavily on EU GDPR with local adaptations
- **Scope**: Applies to organizations processing personal data of individuals in Thailand

#### Key Requirements for NutriVision

**1. Legal Basis for Processing**
- **Consent**: Must obtain explicit consent for health data collection
- **Legitimate Interest**: Can process for service provision
- **Contractual Necessity**: Processing required to deliver service

**NutriVision Implementation**:
- ✅ Clear consent flow during onboarding
- ✅ Option to decline optional data collection
- ✅ Granular consent (e.g., marketing separate from service)

**2. Sensitive Personal Data**
- **Definition**: Health data, biometric data, race, religion, sexual preference, criminal records
- **Requirements**: **Explicit consent** required for collection, use, or disclosure
- **Exceptions**: Medical treatment, legal requirements, vital interests

**NutriVision Impact**:
- ⚠️ **Health data = sensitive personal data**
- ✅ Explicit consent required for:
  - Nutrition scan results
  - Health goals and conditions
  - Body metrics (weight, height, age)
  - Medical history (diabetes, allergies)

**Consent Language Example**:
> "NutriVision AI will collect and process your health information including nutrition scans, body metrics, and health goals to provide personalized nutrition recommendations. This data will be stored securely and will not be shared with third parties without your explicit permission. You can withdraw consent at any time. [Accept] [Decline]"

**3. Data Subject Rights**
Users have the right to:
- ✅ **Access**: Request copy of their data
- ✅ **Rectify**: Correct inaccurate data
- ✅ **Erase**: Request data deletion (right to be forgotten)
- ✅ **Port**: Export data in machine-readable format
- ✅ **Object**: Opt-out of certain processing
- ✅ **Restrict**: Limit how data is used

**NutriVision Implementation**:
- In-app settings: "Download My Data" (CSV/JSON export)
- "Delete My Account" with confirmation
- Data portability to export all scans, meals, reports
- Clear opt-out for marketing communications

**4. Data Breach Notification**
- **Timeline**: Notify PDPC within **72 hours** of discovering breach
- **User Notification**: If breach puts rights/freedoms at risk, notify affected users "without delay"
- **Requirements**: Describe breach, impact, remediation steps

**NutriVision Preparation**:
- Incident response plan documented
- Security contact designated
- Breach detection monitoring
- Template notification prepared

**5. Penalties for Non-Compliance**
- **Administrative Fines**: THB 500,000 - THB 5,000,000 per violation
- **Criminal Penalties**: Up to 1 year imprisonment for certain breaches
- **Compensatory Damages**: Liable for damages to affected individuals

**Risk Level**: HIGH - Compliance is mandatory, penalties severe

#### PDPA Compliance Checklist for NutriVision

✅ **Privacy Policy** (Thai + English)
- Clear, accessible, plain language
- Describes data collection, use, storage, sharing
- User rights explained
- Contact information for data protection officer

✅ **Consent Management**
- Explicit consent for health data
- Granular consent options
- Easy withdrawal mechanism
- Consent records maintained

✅ **Data Security**
- Encryption at rest and in transit
- Access controls and authentication
- Regular security audits
- Vendor due diligence (Google Gemini, cloud providers)

✅ **Data Minimization**
- Collect only necessary data
- Retention policies (delete after X years)
- Anonymization where possible

✅ **User Rights Implementation**
- Data export functionality
- Account deletion
- Data rectification interface
- Response process (within 30 days)

✅ **Records & Documentation**
- Processing activity records
- Consent logs
- Data breach logs
- DPO appointment (if >500 employees)

---

### B. Medical Device Regulations

#### Thai FDA Medical Device Control Division

**Critical Question**: Is NutriVision AI a medical device?

**Medical Device Definition** (Thai FDA):
> Products that make therapeutic, medical, or dental claims are considered medical devices, including software as a medical device (SaMD).

#### Risk Assessment

**If NutriVision Makes These Claims** → Medical Device:
- ❌ "Treats diabetes"
- ❌ "Prevents disease"
- ❌ "Diagnoses health conditions"
- ❌ "Prescribes diet for medical conditions"
- ❌ "Monitors blood glucose levels"

**If NutriVision Makes These Claims** → Likely NOT Medical Device:
- ✅ "Provides nutrition information"
- ✅ "Helps track meals"
- ✅ "Educational tool for healthy eating"
- ✅ "Personal nutrition assistant"
- ✅ "Analyzes food content"

#### NutriVision Positioning Strategy (to avoid medical device classification)

**1. Educational & Informational Framing**
- Position as "nutrition education tool"
- "For informational purposes only"
- "Not a substitute for professional medical advice"

**2. Disclaimers**
- ⚠️ **Prominent disclaimer**: "NutriVision AI provides nutrition information for educational purposes. It is not intended to diagnose, treat, cure, or prevent any disease. Always consult a healthcare professional for medical advice."

**3. Avoid Medical Claims**
- Don't claim to "treat" or "cure"
- Use "may help support" instead of "improves"
- Focus on nutrition knowledge, not medical outcomes

**4. No Integration with Medical Devices (initially)**
- Don't connect to glucose monitors
- Don't integrate with medical records (phase 1)
- Position as general wellness, not medical

#### If Medical Device Classification Required

**Process**:
1. **Determine Class**: I, II, III, or IV (based on risk)
2. **Appoint Local Authorized Representative** (Thailand)
3. **Prepare Documentation**:
   - Technical specifications
   - Safety/performance data
   - Clinical evidence (if Class III/IV)
   - Quality management system (ISO 13485)
4. **Submit Application**: Thai FDA review (3-6 months)
5. **Registration Fee**: THB 10,000 - 50,000
6. **Ongoing**: Annual renewal, adverse event reporting

**Timeline**: 6-12 months
**Cost**: THB 500,000 - 2,000,000 (including consulting)

**Recommendation**: Avoid medical device classification in Phase 1-2 through careful positioning. Consider registration for Phase 3 if expanding to clinical partnerships.

---

### C. Food & Health Claims Regulations

#### Thai FDA Food Regulations

**Nutrition Claims**: ✅ Permitted if supported by analysis
- Example: "High in fiber" if meets threshold

**Health Claims**: ❌ Forbidden for food products
- Health claims relate to benefits, efficacies, functions
- Example: "Reduces cholesterol" is prohibited

**NutriVision Impact**:
- ✅ Can show nutritional content (calories, protein, etc.)
- ✅ Can show nutrient density
- ⚠️ Be careful with health benefit language
- ❌ Don't claim food "treats" or "cures" conditions

**Safe Language**:
- "High in protein" ✅
- "Good source of fiber" ✅
- "Low glycemic index" ✅
- "May support blood sugar management" ⚠️ (borderline)
- "Cures diabetes" ❌

---

### D. Consumer Protection Act

#### Office of the Consumer Protection Board (OCPB)

**Key Requirements**:
1. **No Misleading Claims**: Accuracy in marketing
2. **Clear Pricing**: Transparent subscription terms
3. **Cancellation Rights**: Easy subscription cancellation
4. **Refund Policy**: Clear refund terms
5. **Terms of Service**: Accessible, fair terms

**NutriVision Compliance**:
- ✅ Accurate food recognition disclaimers ("90%+ accuracy" not "100% accurate")
- ✅ Clear subscription terms (renewal, cancellation)
- ✅ Easy cancellation (in-app, no calls required)
- ✅ Refund policy (7-day satisfaction guarantee option)
- ✅ Terms of Service and Privacy Policy prominently linked

---

## 2. GDPR (European Union)

### Applicability
- **Scope**: Applies if offering services to individuals in EU
- **Trigger**: Marketing to EU, accepting EU users
- **NutriVision**: Not targeting EU initially, but may have incidental EU users

### Key Differences from PDPA
- **Higher fines**: Up to €20M or 4% of global revenue (whichever is greater)
- **Data Protection Officer**: Required for large-scale health data processing
- **Data Transfer**: Strict rules on transferring data outside EU

### NutriVision Approach (Phase 1)
- Geo-block EU users initially (focus on Thailand/SEA)
- If EU expansion desired (Phase 3+), ensure full GDPR compliance

---

## 3. Other Southeast Asian Regulations

### Singapore

**Personal Data Protection Act (PDPA Singapore)**
- Similar to Thailand PDPA
- Strict enforcement by PDPC
- Consent-based model

**Health Products Act**
- Medical device regulations apply to SaMD
- Similar positioning strategy (avoid medical claims)

**Expansion Readiness**:
- High (similar legal framework)
- Compliance with Thailand PDPA = 80% ready for Singapore

---

### Malaysia

**Personal Data Protection Act 2010 (PDPA Malaysia)**
- Pre-dates GDPR (older model)
- Consent required for personal data
- Less strict than EU/Thailand but still regulated

**Medical Device Authority (MDA)**
- Regulates medical devices including software
- Similar avoidance strategy applies

**Expansion Readiness**:
- High (similar framework)
- Focus on Islamic/Halal considerations (food aspects)

---

### Indonesia

**Personal Data Protection Law (Undang-Undang PDP)**
- Enacted 2022, enforcement ramping up
- Similar to GDPR framework
- Growing enforcement

**Ministry of Health Regulations**
- Medical device registration required
- Telemedicine regulations evolving

**Expansion Readiness**:
- Medium (regulatory environment evolving)
- Local partner recommended for compliance

---

## 4. Intellectual Property Protection

### Trademarks

**NutriVision AI Brand**
- ✅ Register trademark in Thailand (class 9, 42, 44)
- ✅ Register in key SEA markets (Singapore, Malaysia, Indonesia)
- ✅ Domain names secured (.com, .co.th, .app)

**Cost**: THB 8,000 - 15,000 per country per class

### Patents

**8-Dimension Scoring Methodology**
- Consider patent application for proprietary algorithm
- Trade secret vs. patent trade-off
  - Patent: Public but protected
  - Trade secret: Private but not legally protected

**Recommendation**: Patent key innovations, keep implementation details as trade secrets

### Copyright

**Content & Database**
- Thai food database: Original compilation (copyright protected)
- App UI/UX: Design rights
- Marketing content: Copyright protection

**Registration**: Automatic, but registration aids enforcement

---

## 5. Terms of Service & Legal Documents

### Required Documents

**1. Terms of Service**
- User obligations and restrictions
- Service limitations and disclaimers
- Liability limitations
- Termination rights
- Governing law (Thai law)
- Dispute resolution (arbitration)

**2. Privacy Policy** (PDPA required)
- Data collection practices
- Use of data
- Data sharing (partners, vendors)
- User rights
- Security measures
- Contact information

**3. Disclaimers**
- ⚠️ **Medical Disclaimer**: "Not medical advice"
- ⚠️ **Accuracy Disclaimer**: "AI recognition may not be 100% accurate"
- ⚠️ **Results Disclaimer**: "Results vary, not guaranteed"

**4. Acceptable Use Policy**
- Prohibited uses
- Content guidelines (user-generated)
- Enforcement and consequences

### Key Provisions to Include

**Limitation of Liability**:
> "To the maximum extent permitted by law, NutriVision AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill."

**Indemnification**:
> "You agree to indemnify and hold NutriVision AI harmless from any claims arising from your use of the service."

**Arbitration Clause**:
> "Any disputes shall be resolved through binding arbitration in Bangkok, Thailand, under Thai law."

**Changes to Terms**:
> "We may update these terms. Continued use after changes constitutes acceptance."

---

## 6. Data Security & Technical Compliance

### Security Standards

**ISO 27001** (Information Security Management)
- Consider certification (Phase 2-3)
- Demonstrates security commitment
- Required for some enterprise clients

**SOC 2** (Service Organization Control)
- Relevant for B2B/enterprise sales
- Trust and security assurance

**HIPAA** (if entering US market)
- Required for healthcare data in US
- Not applicable for Thailand initially

### Technical Requirements

**1. Data Encryption**
- ✅ HTTPS/TLS for all data transmission
- ✅ AES-256 encryption for data at rest
- ✅ Encrypted database backups

**2. Authentication & Authorization**
- ✅ Strong password requirements (8+ chars, complexity)
- ✅ Two-factor authentication option
- ✅ Role-based access control (admin, user)
- ✅ Session management and timeouts

**3. Logging & Monitoring**
- ✅ Access logs (who accessed what, when)
- ✅ Security event monitoring
- ✅ Intrusion detection
- ✅ Regular security audits

**4. Vendor Security**
- ✅ Google Cloud Platform (Gemini AI, storage)
  - SOC 2, ISO 27001 certified
  - GDPR compliant
  - Data processing agreement required
- ✅ Review vendor security annually

**5. Backup & Disaster Recovery**
- ✅ Daily database backups
- ✅ Geographic redundancy
- ✅ Disaster recovery plan
- ✅ Recovery time objective (RTO): <24 hours

---

## 7. Compliance Roadmap

### Phase 1: Launch (Months 1-6)

**Must-Have** (Legal Blockers):
- ✅ PDPA-compliant Privacy Policy (Thai + English)
- ✅ Terms of Service with proper disclaimers
- ✅ Consent management system
- ✅ Data encryption (rest + transit)
- ✅ Account deletion functionality

**Should-Have** (Risk Mitigation):
- ✅ Security audit by external firm
- ✅ Legal review of claims (avoid medical device classification)
- ✅ Trademark application filed

**Cost**: THB 500,000 - 800,000
**Resources**: External law firm + security consultant

---

### Phase 2: Scale (Months 6-18)

**Must-Have**:
- ✅ Data protection officer appointed (if needed)
- ✅ Vendor data processing agreements
- ✅ Incident response plan tested
- ✅ Compliance documentation complete

**Should-Have**:
- ✅ ISO 27001 certification initiated
- ✅ Patent application for key innovations
- ✅ Regional trademark registrations (SEA)

**Cost**: THB 1,000,000 - 1,500,000

---

### Phase 3: Regional Expansion (Months 18-36)

**Must-Have**:
- ✅ Compliance for new markets (Malaysia, Singapore)
- ✅ Localized privacy policies
- ✅ Local legal entity establishment
- ✅ Local data hosting (if required)

**Should-Have**:
- ✅ SOC 2 certification (for enterprise sales)
- ✅ Medical device registration (if clinical partnerships)
- ✅ Additional patents filed

**Cost**: THB 2,000,000 - 3,000,000

---

## 8. Risk Assessment & Mitigation

### High-Risk Areas

**Risk 1: Medical Device Classification**
- **Likelihood**: MEDIUM (depends on claims)
- **Impact**: HIGH (6-12 month delay, THB 1-2M cost)
- **Mitigation**: Careful positioning, legal review of all content, avoid medical claims

**Risk 2: PDPA Data Breach**
- **Likelihood**: LOW (with proper security)
- **Impact**: VERY HIGH (fines, reputation damage)
- **Mitigation**: Strong security, encryption, monitoring, incident response plan, insurance

**Risk 3: Misleading Claims / Consumer Complaints**
- **Likelihood**: MEDIUM (subjective interpretation)
- **Impact**: MEDIUM (fines, bad PR, customer refunds)
- **Mitigation**: Accuracy disclaimers, conservative claims, responsive customer service

**Risk 4: IP Infringement Claims**
- **Likelihood**: LOW (original work)
- **Impact**: MEDIUM-HIGH (legal costs, potential injunction)
- **Mitigation**: Freedom-to-operate search, patent filing, trademark registration

---

## 9. Insurance & Legal Protection

### Recommended Insurance Policies

**1. Cyber Liability Insurance**
- **Coverage**: Data breaches, cyber attacks, regulatory fines
- **Cost**: THB 100,000 - 300,000 annually
- **Limit**: THB 50M - 100M coverage

**2. Professional Liability (E&O)**
- **Coverage**: Errors in advice, system failures, user harm
- **Cost**: THB 150,000 - 400,000 annually
- **Limit**: THB 30M - 50M coverage

**3. General Liability**
- **Coverage**: General business operations
- **Cost**: THB 50,000 - 100,000 annually

**Total Annual Insurance Cost**: THB 300,000 - 800,000

---

## 10. Compliance Team & Resources

### Internal Roles

**Phase 1** (Months 1-6):
- Founder/CEO: Overall responsibility
- CTO: Technical security
- External law firm: Legal compliance (retained)

**Phase 2** (Months 6-18):
- **Data Protection Officer** (part-time/outsourced): PDPA compliance
- **Compliance Lead** (contractor): Policies, training, audits
- External law firm: Ongoing support

**Phase 3** (Months 18-36):
- **Chief Compliance Officer** (full-time hire): Multi-country compliance
- Legal counsel in-house or retained
- Regional compliance specialists

### External Resources

**Legal Firms in Thailand** (Digital Health Experience):
- **Tilleke & Gibbins**: Leading IP and digital firm
- **Baker McKenzie**: International with strong Thailand practice
- **Weerawong C&P**: Top Thai firm, tech focus

**Security Consultants**:
- **Deloitte Thailand**: Cyber security practice
- **PwC Thailand**: Risk and security services
- Local boutique security firms

**Cost Estimates**:
- Legal: THB 50,000 - 150,000 setup, THB 20,000 - 50,000 monthly retainer
- Security audit: THB 200,000 - 500,000 one-time
- ISO certification: THB 500,000 - 1,000,000 total

---

## Conclusion: Compliance as Competitive Advantage

### Key Takeaways

1. **PDPA Compliance is Table Stakes**: Non-negotiable for operating in Thailand
2. **Avoid Medical Device Classification**: Through careful positioning and disclaimers
3. **Security Investment Pays Off**: Prevents breaches, enables enterprise sales
4. **Proactive > Reactive**: Build compliance in from day 1, not as afterthought
5. **Regional Consistency**: Compliance in Thailand = easier expansion to SEA

### Compliance Budget Summary

**Year 1**: THB 800,000 - 1,200,000
**Year 2**: THB 1,500,000 - 2,000,000
**Year 3**: THB 2,500,000 - 3,500,000

### Compliance as Differentiator

Strong compliance position provides:
- ✅ **Trust**: Users feel safe sharing health data
- ✅ **Enterprise Sales**: B2B clients require compliance proof
- ✅ **Insurance Partnerships**: Insurers need PDPA + security assurance
- ✅ **Hospital Partnerships**: Healthcare providers demand high standards
- ✅ **Investor Confidence**: Reduces regulatory risk

**Bottom Line**: Invest in compliance early. It's cheaper than fixing problems later and enables growth opportunities that non-compliant competitors cannot access.
