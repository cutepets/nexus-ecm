# Entity-Relationship Diagram (ERD)
### Nexus ECM · v1.0

Rendered with **Mermaid** (GitHub/VS Code render this natively). The model is split into domain
sub-diagrams for readability; relationships that cross domains are noted. The authoritative source of
truth is [`../packages/database/schema.prisma`](../packages/database/schema.prisma).

Legend: `||--o{` = one-to-many · `||--||` = one-to-one · `}o--o{` = many-to-many (via join table).

---

## 1. Identity, RBAC & Audit

```mermaid
erDiagram
    User ||--o{ RefreshToken : has
    User ||--o{ UserRole : assigned
    Role ||--o{ UserRole : grants
    Role ||--o{ RolePermission : has
    Permission ||--o{ RolePermission : in
    User ||--o{ AuditLog : performs
    User ||--o{ Notification : receives
    User ||--|| Employee : "is (optional)"

    User {
        string id PK
        string email UK
        string passwordHash
        string fullName
        string avatarUrl
        boolean isActive
        datetime lastLoginAt
        datetime createdAt
        datetime updatedAt
    }
    Role {
        string id PK
        string name UK
        string description
        boolean isSystem
    }
    Permission {
        string id PK
        string key UK "e.g. employee:create"
        string module
        string description
    }
    UserRole {
        string userId FK
        string roleId FK
    }
    RolePermission {
        string roleId FK
        string permissionId FK
    }
    RefreshToken {
        string id PK
        string userId FK
        string tokenHash
        string deviceInfo
        string ip
        datetime expiresAt
        datetime revokedAt
    }
    AuditLog {
        string id PK
        string actorId FK
        string action "LOGIN|CREATE|UPDATE|DELETE..."
        string entity
        string entityId
        json before
        json after
        string ip
        string userAgent
        datetime createdAt
    }
    Notification {
        string id PK
        string userId FK
        string type
        string title
        string body
        json data
        boolean isRead
        string channel "IN_APP|EMAIL"
        datetime createdAt
    }
```

---

## 2. Employee / HR

```mermaid
erDiagram
    Department ||--o{ Position : contains
    Department ||--o{ Employee : employs
    Position ||--o{ Employee : holds
    Employee ||--o{ JobHistory : has
    Employee ||--o{ SalaryHistory : has
    Employee ||--o{ EmployeeDocument : owns
    Employee ||--o{ Employee : "manages (manager)"

    Department {
        string id PK
        string name
        string code UK
        string managerId FK
    }
    Position {
        string id PK
        string title
        string departmentId FK
        int level
    }
    Employee {
        string id PK
        string userId FK "optional link to User"
        string employeeNo UK
        string fullName
        string photoUrl
        string email
        string phone
        string address
        string departmentId FK
        string positionId FK
        string managerId FK
        enum workStatus "PROBATION|PERMANENT|CONTRACT|INACTIVE"
        date joinDate
        date exitDate
        datetime createdAt
    }
    JobHistory {
        string id PK
        string employeeId FK
        string positionId FK
        string departmentId FK
        date startDate
        date endDate
        string note
    }
    SalaryHistory {
        string id PK
        string employeeId FK
        decimal amount
        string currency
        date effectiveDate
        string reason
    }
    EmployeeDocument {
        string id PK
        string employeeId FK
        enum docType "KTP|NPWP|CV|CONTRACT|OTHER"
        string fileUrl
        string fileName
        enum status "PENDING|VERIFIED|REJECTED"
        datetime uploadedAt
    }
```

---

## 3. Attendance & Face Recognition

```mermaid
erDiagram
    Employee ||--o{ FaceProfile : enrolls
    Employee ||--o{ Attendance : records
    WorkSchedule ||--o{ Department : applies

    FaceProfile {
        string id PK
        string employeeId FK
        bytes  embedding "float vector"
        float  quality
        string sampleImageUrl
        boolean isPrimary
        datetime createdAt
    }
    Attendance {
        string id PK
        string employeeId FK
        date   workDate
        datetime checkInAt
        datetime checkOutAt
        float  checkInLat
        float  checkInLng
        float  checkOutLat
        float  checkOutLng
        string checkInPhotoUrl
        string checkOutPhotoUrl
        json   deviceInfo
        float  matchScore
        boolean livenessPassed
        enum   status "PRESENT|LATE|LEAVE|PERMIT|ABSENT"
    }
    WorkSchedule {
        string id PK
        string name
        time   startTime
        time   endTime
        int    graceMinutes
    }
```

---

## 4. Leave Management

```mermaid
erDiagram
    Employee ||--o{ LeaveRequest : submits
    LeaveType ||--o{ LeaveRequest : categorizes
    LeaveRequest ||--o{ LeaveApproval : "has steps"
    Employee ||--o{ LeaveApproval : approves
    Employee ||--o{ LeaveBalance : holds
    LeaveType ||--o{ LeaveBalance : tracks

    LeaveType {
        string id PK
        string name "Cuti|Izin|Sakit"
        int    defaultQuota
        boolean requiresDoc
    }
    LeaveRequest {
        string id PK
        string employeeId FK
        string leaveTypeId FK
        date   startDate
        date   endDate
        string reason
        string documentUrl
        enum   status "PENDING|APPROVED|REJECTED"
        int    currentStep
        datetime createdAt
    }
    LeaveApproval {
        string id PK
        string leaveRequestId FK
        int    step "1..4"
        string role "SUPERVISOR|MANAGER|HR"
        string approverId FK
        enum   decision "PENDING|APPROVED|REJECTED"
        string comment
        datetime decidedAt
    }
    LeaveBalance {
        string id PK
        string employeeId FK
        string leaveTypeId FK
        int    year
        int    allocated
        int    used
    }
```

---

## 5. Projects & Tasks

```mermaid
erDiagram
    Project ||--o{ Milestone : has
    Project ||--o{ Task : contains
    Project ||--o{ ProjectMember : staffed
    Employee ||--o{ ProjectMember : member
    Task ||--o{ TaskAssignee : assigned
    Employee ||--o{ TaskAssignee : works
    Task ||--o{ ChecklistItem : has
    Task ||--o{ TaskComment : has
    Task ||--o{ TaskAttachment : has
    Milestone ||--o{ Task : groups

    Project {
        string id PK
        string name
        string code UK
        string description
        enum   status "PLANNING|ACTIVE|COMPLETED|CANCELLED"
        date   startDate
        date   deadline
        int    progress "0-100"
        decimal budgetPlanned
        decimal budgetActual
        string managerId FK
    }
    Milestone {
        string id PK
        string projectId FK
        string title
        date   dueDate
        boolean completed
    }
    ProjectMember {
        string projectId FK
        string employeeId FK
        string role
    }
    Task {
        string id PK
        string projectId FK
        string milestoneId FK
        string title
        string description
        enum   priority "LOW|MEDIUM|HIGH|CRITICAL"
        enum   status "TODO|IN_PROGRESS|REVIEW|DONE"
        date   dueDate
        int    orderIndex
        datetime createdAt
    }
    TaskAssignee {
        string taskId FK
        string employeeId FK
    }
    ChecklistItem {
        string id PK
        string taskId FK
        string label
        boolean done
        int    orderIndex
    }
    TaskComment {
        string id PK
        string taskId FK
        string authorId FK
        string body
        datetime createdAt
    }
    TaskAttachment {
        string id PK
        string taskId FK
        string fileUrl
        string fileName
        datetime uploadedAt
    }
```

---

## 6. Finance

```mermaid
erDiagram
    Customer ||--o{ Invoice : billed
    Invoice ||--o{ InvoiceItem : has
    Invoice ||--o{ Payment : receives
    ExpenseCategory ||--o{ Expense : categorizes
    Employee ||--o{ Reimbursement : requests
    Employee ||--o{ Expense : "recorded by"

    Invoice {
        string id PK
        string number UK
        string customerId FK
        date   issueDate
        date   dueDate
        decimal subtotal
        decimal tax
        decimal total
        enum   status "DRAFT|SENT|PARTIAL|PAID|OVERDUE|VOID"
        datetime createdAt
    }
    InvoiceItem {
        string id PK
        string invoiceId FK
        string description
        decimal quantity
        decimal unitPrice
        decimal lineTotal
    }
    Payment {
        string id PK
        string invoiceId FK
        decimal amount
        string method
        date   paidAt
        string reference
    }
    ExpenseCategory {
        string id PK
        string name "OPERATIONAL|PURCHASE|SALARY|REIMBURSEMENT"
    }
    Expense {
        string id PK
        string categoryId FK
        string title
        decimal amount
        date   spentAt
        string recordedById FK
        string receiptUrl
        enum   status "DRAFT|APPROVED|PAID"
    }
    Reimbursement {
        string id PK
        string employeeId FK
        string title
        decimal amount
        string receiptUrl
        enum   status "PENDING|APPROVED|REJECTED|PAID"
        string approverId FK
        datetime createdAt
    }
```

---

## 7. Inventory

```mermaid
erDiagram
    Category ||--o{ Item : classifies
    Supplier ||--o{ Item : supplies
    Warehouse ||--o{ StockMovement : at
    Item ||--o{ StockMovement : moves

    Category { string id PK  string name  string parentId FK }
    Supplier {
        string id PK
        string name
        string contactName
        string phone
        string email
        string address
    }
    Warehouse { string id PK  string name  string location }
    Item {
        string id PK
        string sku UK
        string name
        string categoryId FK
        string supplierId FK
        string unit
        int    reorderLevel
        decimal unitCost
        string barcode
        string qrCodeUrl
    }
    StockMovement {
        string id PK
        string itemId FK
        string warehouseId FK
        enum   type "IN|OUT|ADJUST"
        int    quantity
        string reference
        string note
        datetime createdAt
    }
```

---

## 8. CRM

```mermaid
erDiagram
    Customer ||--o{ Interaction : has
    Customer ||--o{ Opportunity : tied
    Lead ||--o{ Opportunity : converts
    PipelineStage ||--o{ Opportunity : at
    Employee ||--o{ Interaction : owner
    Employee ||--o{ Opportunity : owner

    Customer {
        string id PK
        string name
        string company
        string email
        string phone
        string address
        enum   type "PROSPECT|ACTIVE|CHURNED"
    }
    Lead {
        string id PK
        string name
        string source
        string email
        string phone
        enum   status "NEW|CONTACTED|QUALIFIED|LOST"
        string ownerId FK
    }
    PipelineStage {
        string id PK
        string name "Qualification|Proposal|Negotiation|Won|Lost"
        int    orderIndex
        int    probability
    }
    Opportunity {
        string id PK
        string customerId FK
        string leadId FK
        string stageId FK
        string title
        decimal value
        date   expectedClose
        string ownerId FK
    }
    Interaction {
        string id PK
        string customerId FK
        enum   type "CALL|EMAIL|MEETING|NOTE"
        string summary
        string ownerId FK
        datetime occurredAt
    }
```

---

## 9. Documents

```mermaid
erDiagram
    Folder ||--o{ Folder : "nests (parent)"
    Folder ||--o{ Document : contains
    Document ||--o{ DocumentVersion : versions
    Document ||--o{ DocumentShare : shared
    User ||--o{ DocumentShare : with

    Folder { string id PK  string name  string parentId FK  string ownerId FK }
    Document {
        string id PK
        string folderId FK
        string title
        enum   docType "SOP|CONTRACT|INVOICE|LETTER|OTHER"
        string currentVersionId
        string ownerId FK
        datetime createdAt
    }
    DocumentVersion {
        string id PK
        string documentId FK
        int    version
        string fileUrl
        string fileName
        int    sizeBytes
        string uploadedById FK
        datetime uploadedAt
    }
    DocumentShare {
        string id PK
        string documentId FK
        string sharedWithUserId FK
        enum   access "VIEW|EDIT"
    }
```

---

## 10. Internal Communication

```mermaid
erDiagram
    Conversation ||--o{ ConversationMember : has
    User ||--o{ ConversationMember : in
    Conversation ||--o{ Message : contains
    User ||--o{ Message : sends
    Message ||--o{ MessageAttachment : has
    Message ||--o{ MessageMention : mentions
    User ||--o{ Announcement : posts

    Conversation {
        string id PK
        enum   type "DIRECT|GROUP"
        string name
        string createdById FK
        datetime createdAt
    }
    ConversationMember {
        string conversationId FK
        string userId FK
        datetime lastReadAt
    }
    Message {
        string id PK
        string conversationId FK
        string senderId FK
        string body
        datetime createdAt
        datetime editedAt
    }
    MessageAttachment {
        string id PK
        string messageId FK
        string fileUrl
        string fileName
    }
    MessageMention {
        string messageId FK
        string userId FK
    }
    Announcement {
        string id PK
        string authorId FK
        string title
        string body
        enum   audience "ALL|DEPARTMENT|ROLE"
        string targetRef
        datetime publishedAt
    }
```

---

## Cross-domain relationships (summary)
- `User 1—1 Employee` (an Employee may have a login account).
- `Employee` appears as actor across Attendance, Leave, Projects, Tasks, Finance (reimbursement), CRM (owner).
- `AuditLog.actorId → User` captures every mutating action across all modules.
- `Notification.userId → User` is the sink for all module events.
- File URLs (`*Url`) across modules point to objects in **MinIO**; access via presigned URLs.
