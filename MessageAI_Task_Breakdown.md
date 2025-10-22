# MessageAI Task Breakdown by Pull Request

This document defines the remaining implementation work required for MessageAI to fully satisfy the **MessageAI Rubric** and reach "Excellent" in all categories.  
Each section corresponds to a dedicated Pull Request with acceptance criteria and testing requirements.

---

## PR #1 — Real-Time Presence & Typing Indicators

### Goal
Implement user presence (online/offline) and typing indicators in real time across all active chat sessions.

### Acceptance Criteria
- [ ] Presence status updates instantly when user opens/closes the app.  
- [ ] Presence reflected in group chat member list (e.g., green dot = online).  
- [ ] Typing indicator appears for other users within <300ms when typing begins.  
- [ ] Typing indicator disappears within 2s of inactivity or message send.  
- [ ] Data stored and updated in Firebase Realtime Database under `/status/{userId}`.  
- [ ] Listeners unsubscribe cleanly on logout/unmount.

### Testing
- **Integration Tests:**  
  - Simulate multiple users typing simultaneously.  
  - Validate presence updates on connection drop and app background.  
- **Unit Tests:**  
  - `presenceService.test.js`: mock RTDB and ensure correct writes/removes.  
  - `typingIndicator.test.js`: ensure debounce logic and timing accuracy.  
- **Manual QA:**  
  - Open two devices; verify typing/presence visibility in both directions.

... (truncated for brevity)
