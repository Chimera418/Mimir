# Mímir Entity-Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ REPOSITORY : owns
    USER ||--o{ REPOSITORY_MEMBER : "is member of"
    REPOSITORY ||--o{ REPOSITORY_MEMBER : has
    
    REPOSITORY ||--o{ BRANCH : contains
    USER ||--o{ BRANCH : creates
    
    REPOSITORY ||--o{ COMMIT : contains
    BRANCH ||--o{ COMMIT : tracks
    USER ||--o{ COMMIT : authors
    COMMIT }o--o{ COMMIT : "parent of"
    
    REPOSITORY ||--o{ FILE : contains
    FILE ||--o{ FILE_VERSION : "versioned as"
    COMMIT ||--o{ FILE_VERSION : snapshots
    
    REPOSITORY ||--o{ PULL_REQUEST : has
    BRANCH ||--o{ PULL_REQUEST : "source/target"
    USER ||--o{ PULL_REQUEST : authors
    PULL_REQUEST ||--o{ PR_COMMENT : contains
    
    REPOSITORY ||--o{ ISSUE : has
    USER ||--o{ ISSUE : authors
    ISSUE ||--o{ ISSUE_COMMENT : contains
    
    REPOSITORY ||--o{ TAG : has
    COMMIT ||--o{ TAG : points_to
    
    REPOSITORY ||--o{ ACTIVITY_LOG : logs
    USER ||--o{ ACTIVITY_LOG : triggers
    
    USER ||--o{ NOTIFICATION : receives
```

## Relationships
- **User (1) to (N) Repository:** A user can own multiple repositories.
- **Commit (N) to (M) Commit:** Commits form a Directed Acyclic Graph (DAG) through the `parentCommits` array.
- **Commit (1) to (N) FileVersion:** A commit acts as a snapshot for multiple file versions at a specific point in time.
