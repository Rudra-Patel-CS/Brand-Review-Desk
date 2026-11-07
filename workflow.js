/* Brand Review Desk - Review Workflow, Co-Approval & Event Audit Trail
   Manages workflow states (Draft -> In Review -> Changes Requested / Approved / Rejected),
   role authorization, co-approval / self-approval restrictions, critical override reasons,
   and persistent chronological audit logging with idempotency.
*/

const crypto = require('crypto');

let dbModule = null;
function getDbModule() {
  if (!dbModule) {
    try {
      dbModule = require('./db');
    } catch {}
  }
  return dbModule;
}

const WORKFLOW_STATUSES = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// Normalized status mapper (including legacy presets)
function normalizeStatus(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'under_review') return WORKFLOW_STATUSES.IN_REVIEW;
  if (s === 'action_required') return WORKFLOW_STATUSES.DRAFT;
  if (Object.values(WORKFLOW_STATUSES).includes(s)) return s;
  return WORKFLOW_STATUSES.DRAFT;
}

// State transition graph
const VALID_TRANSITIONS = {
  [WORKFLOW_STATUSES.DRAFT]: [WORKFLOW_STATUSES.IN_REVIEW],
  [WORKFLOW_STATUSES.IN_REVIEW]: [
    WORKFLOW_STATUSES.CHANGES_REQUESTED,
    WORKFLOW_STATUSES.APPROVED,
    WORKFLOW_STATUSES.REJECTED
  ],
  [WORKFLOW_STATUSES.CHANGES_REQUESTED]: [
    WORKFLOW_STATUSES.DRAFT,
    WORKFLOW_STATUSES.IN_REVIEW
  ],
  [WORKFLOW_STATUSES.REJECTED]: [
    WORKFLOW_STATUSES.DRAFT
  ],
  [WORKFLOW_STATUSES.APPROVED]: [
    WORKFLOW_STATUSES.IN_REVIEW,
    WORKFLOW_STATUSES.DRAFT
  ]
};

// Allowed roles for each target transition
const ROLE_PERMISSIONS = {
  [WORKFLOW_STATUSES.IN_REVIEW]: ['reviewer', 'approver', 'admin'],
  [WORKFLOW_STATUSES.CHANGES_REQUESTED]: ['reviewer', 'approver', 'admin'],
  [WORKFLOW_STATUSES.APPROVED]: ['approver', 'admin'],
  [WORKFLOW_STATUSES.REJECTED]: ['approver', 'admin'],
  [WORKFLOW_STATUSES.DRAFT]: ['reviewer', 'approver', 'admin']
};

/**
 * Checks whether the user is attempting to approve their own work.
 * Self-approval occurs if the user created, uploaded, or was the designated reviewer for the campaign.
 */
function isSelfApproval(campaign, user) {
  if (!campaign || !user) return false;

  const currentUserId = String(user.id || user._id || '');
  const currentUsername = String(user.username || '').toLowerCase();

  const creatorId = String(campaign.creatorId || campaign.userId || '');
  const creatorName = String(campaign.createdBy || campaign.assetMetadata?.uploadedBy || '').toLowerCase();

  const reviewerId = String(campaign.reviewerId || '');
  const reviewerName = String(campaign.reviewedBy || '').toLowerCase();

  const isCreator = (creatorId && creatorId === currentUserId) ||
                    (creatorName && creatorName === currentUsername);

  const isReviewer = (reviewerId && reviewerId === currentUserId) ||
                     (reviewerName && reviewerName === currentUsername);

  return Boolean(isCreator || isReviewer);
}

/**
 * Persists an event into MongoDB 'events' collection or in-memory fallback.
 * Idempotent: rejects duplicate events when idempotencyKey is reused.
 */
async function logEvent(eventData, options = {}) {
  const { database, memoryStore } = options;

  const eventDoc = {
    _id: eventData.id || `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    id: eventData.id || `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    campaignId: String(eventData.campaignId || ''),
    reviewId: eventData.reviewId ? String(eventData.reviewId) : undefined,
    actionType: String(eventData.actionType || 'status_change'),
    fromStatus: eventData.fromStatus ? normalizeStatus(eventData.fromStatus) : undefined,
    toStatus: eventData.toStatus ? normalizeStatus(eventData.toStatus) : undefined,
    user: {
      id: String(eventData.user?.id || eventData.user?._id || 'system'),
      username: String(eventData.user?.username || 'System'),
      role: String(eventData.user?.role || 'reviewer')
    },
    timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
    idempotencyKey: eventData.idempotencyKey ? String(eventData.idempotencyKey) : undefined,
    details: eventData.details || {}
  };

  // Ensure undefined properties are deleted so MongoDB sparse indexes skip them completely
  if (!eventDoc.idempotencyKey) delete eventDoc.idempotencyKey;
  if (!eventDoc.reviewId) delete eventDoc.reviewId;
  if (!eventDoc.fromStatus) delete eventDoc.fromStatus;
  if (!eventDoc.toStatus) delete eventDoc.toStatus;

  let targetDb = database;
  if (!targetDb && options.isConnected !== false) {
    const dbMod = getDbModule();
    if (dbMod && dbMod.isDbConnected()) {
      try {
        targetDb = await dbMod.connectDB();
      } catch {}
    }
  }

  if (targetDb && options.isConnected !== false) {
    try {
      // Check idempotency in database
      if (eventDoc.idempotencyKey) {
        const existing = await targetDb.collection('events').findOne({
          idempotencyKey: eventDoc.idempotencyKey
        });
        if (existing) {
          return existing;
        }
      }

      await targetDb.collection('events').insertOne(eventDoc);
      return eventDoc;
    } catch (err) {
      if (err.code === 11000 && eventDoc.idempotencyKey) {
        // Unique index collision on retry: return existing
        return await targetDb.collection('events').findOne({
          idempotencyKey: eventDoc.idempotencyKey
        });
      }
      console.warn('Database logEvent warning:', err.message);
    }
  }

  // Memory store fallback
  if (memoryStore) {
    if (!Array.isArray(memoryStore.events)) {
      memoryStore.events = [];
    }

    if (eventDoc.idempotencyKey) {
      const existing = memoryStore.events.find(
        (e) => e.idempotencyKey === eventDoc.idempotencyKey
      );
      if (existing) {
        return existing;
      }
    }

    memoryStore.events.push(eventDoc);
  }

  return eventDoc;
}

/**
 * Retrieves the full chronological event history for a given campaign.
 */
async function getCampaignEvents(campaignId, options = {}) {
  const { database, memoryStore } = options;
  const targetId = String(campaignId);

  let targetDb = database;
  if (!targetDb && options.isConnected !== false) {
    const dbMod = getDbModule();
    if (dbMod && dbMod.isDbConnected()) {
      try {
        targetDb = await dbMod.connectDB();
      } catch {}
    }
  }

  if (targetDb && options.isConnected !== false) {
    try {
      return await targetDb.collection('events')
        .find({ campaignId: targetId })
        .sort({ timestamp: 1 })
        .toArray();
    } catch (err) {
      console.warn('Database getCampaignEvents warning:', err.message);
    }
  }

  if (memoryStore && Array.isArray(memoryStore.events)) {
    return memoryStore.events
      .filter((e) => e.campaignId === targetId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  return [];
}

/**
 * Executes a workflow status transition with server-side permission checks,
 * self-approval verification, critical override justification, and audit logging.
 */
async function transitionWorkflow(campaign, transitionParams, options = {}) {
  const {
    targetStatus: rawTarget,
    user,
    notes = '',
    requestedChanges = '',
    criticalOverrideReason = '',
    allowSelfApproval = false,
    idempotencyKey
  } = transitionParams;

  if (!user || !user.role) {
    const err = new Error('Authentication required for workflow actions.');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }

  const currentStatus = normalizeStatus(campaign.status);
  const targetStatus = normalizeStatus(rawTarget);

  // 1. Validate status transition path
  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    const err = new Error(
      `Invalid workflow transition: cannot transition campaign from "${currentStatus}" to "${targetStatus}". Allowed next statuses: ${allowedNext.join(', ') || 'none'}.`
    );
    err.code = 'INVALID_TRANSITION';
    throw err;
  }

  // 2. Validate role permissions
  const allowedRoles = ROLE_PERMISSIONS[targetStatus] || [];
  if (!allowedRoles.includes(user.role)) {
    const err = new Error(
      `Permission denied: Role "${user.role}" is not authorized to transition campaign to "${targetStatus}". Required roles: ${allowedRoles.join(', ')}.`
    );
    err.code = 'UNAUTHORIZED_ROLE';
    throw err;
  }

  // 3. Admin-only re-opening of approved campaigns
  if (currentStatus === WORKFLOW_STATUSES.APPROVED && user.role !== 'admin') {
    const err = new Error('Permission denied: Only Administrators can re-open an approved campaign.');
    err.code = 'UNAUTHORIZED_REOPEN';
    throw err;
  }

  // 4. Self-approval restriction
  if (targetStatus === WORKFLOW_STATUSES.APPROVED) {
    const isSelf = isSelfApproval(campaign, user);
    if (isSelf && !allowSelfApproval && user.role !== 'admin') {
      const err = new Error(
        'Self-approval restricted: You cannot approve a campaign you created or reviewed. A separate approver sign-off is required by policy.'
      );
      err.code = 'SELF_APPROVAL_RESTRICTED';
      throw err;
    }
  }

  // 5. Critical finding override validation
  let hasCriticalOverride = false;
  if (targetStatus === WORKFLOW_STATUSES.APPROVED) {
    const findings = Array.isArray(campaign.initialFindings) ? campaign.initialFindings : [];
    const openCritical = findings.filter(
      (f) => f.severity === 'critical' && f.status === 'open'
    );

    if (openCritical.length > 0) {
      if (!criticalOverrideReason || !criticalOverrideReason.trim()) {
        const err = new Error(
          `Approval blocked: Campaign contains ${openCritical.length} unresolved critical compliance finding(s). Approving requires a documented written override justification.`
        );
        err.code = 'CRITICAL_OVERRIDE_REQUIRED';
        err.openCriticalCount = openCritical.length;
        throw err;
      }
      hasCriticalOverride = true;
    }
  }

  // 6. Build updated campaign document
  const now = new Date();
  const updatedCampaign = {
    ...campaign,
    status: targetStatus,
    updatedAt: now
  };

  // Sign-off attribution
  if (targetStatus === WORKFLOW_STATUSES.IN_REVIEW) {
    updatedCampaign.reviewedBy = user.username;
    updatedCampaign.reviewerId = user.id;
    updatedCampaign.reviewerRole = user.role;
    updatedCampaign.reviewedAt = now;
    if (notes) updatedCampaign.reviewerNotes = notes;
  } else if (targetStatus === WORKFLOW_STATUSES.CHANGES_REQUESTED) {
    updatedCampaign.requestedChanges = requestedChanges || notes;
    updatedCampaign.changesRequestedBy = user.username;
    updatedCampaign.changesRequestedAt = now;
  } else if (targetStatus === WORKFLOW_STATUSES.APPROVED) {
    updatedCampaign.approvedBy = user.username;
    updatedCampaign.approverId = user.id;
    updatedCampaign.approverRole = user.role;
    updatedCampaign.approvedAt = now;
    if (hasCriticalOverride) {
      updatedCampaign.criticalOverrideReason = criticalOverrideReason.trim();
      updatedCampaign.overrideApprovedBy = user.username;
      updatedCampaign.overrideApprovedAt = now;
    }
  } else if (targetStatus === WORKFLOW_STATUSES.REJECTED) {
    updatedCampaign.rejectedBy = user.username;
    updatedCampaign.rejectedId = user.id;
    updatedCampaign.rejectedRole = user.role;
    updatedCampaign.rejectedAt = now;
    updatedCampaign.rejectionReason = notes || 'Compliance standards not met.';
  }

  // 7. Save campaign to database
  const dbModule = require('./db');
  await dbModule.saveWorkspaceCampaign(updatedCampaign);

  // 8. Log primary transition event (with idempotency support)
  const primaryEvent = await logEvent(
    {
      campaignId: campaign.id,
      actionType: targetStatus === WORKFLOW_STATUSES.APPROVED ? 'approved'
        : targetStatus === WORKFLOW_STATUSES.REJECTED ? 'rejected'
        : targetStatus === WORKFLOW_STATUSES.CHANGES_REQUESTED ? 'changes_requested'
        : targetStatus === WORKFLOW_STATUSES.IN_REVIEW ? 'campaign_submitted'
        : 'status_change',
      fromStatus: currentStatus,
      toStatus: targetStatus,
      user,
      timestamp: now,
      idempotencyKey,
      details: {
        notes,
        requestedChanges: targetStatus === WORKFLOW_STATUSES.CHANGES_REQUESTED ? (requestedChanges || notes) : undefined,
        rejectionReason: targetStatus === WORKFLOW_STATUSES.REJECTED ? notes : undefined
      }
    },
    options
  );

  // 9. If an approver overrode critical findings, log a distinct critical_override event
  if (hasCriticalOverride) {
    await logEvent(
      {
        campaignId: campaign.id,
        actionType: 'critical_override',
        user,
        timestamp: new Date(now.getTime() + 1), // 1ms after for strict chronological order
        idempotencyKey: idempotencyKey ? `${idempotencyKey}-override` : undefined,
        details: {
          criticalOverrideReason: criticalOverrideReason.trim(),
          overriddenBy: user.username,
          overriddenRole: user.role
        }
      },
      options
    );
  }

  return {
    success: true,
    campaign: updatedCampaign,
    event: primaryEvent,
    fromStatus: currentStatus,
    toStatus: targetStatus
  };
}

/**
 * Appends a reviewer comment to a campaign and logs an audit event.
 */
async function addCampaignComment(campaign, commentText, user, options = {}) {
  if (!commentText || !commentText.trim()) {
    throw new Error('Comment text cannot be empty.');
  }

  const commentObj = {
    id: `comment-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    },
    comment: commentText.trim(),
    timestamp: new Date()
  };

  const existingComments = Array.isArray(campaign.comments) ? campaign.comments : [];
  const updatedCampaign = {
    ...campaign,
    comments: [...existingComments, commentObj],
    updatedAt: new Date()
  };

  const dbModule = require('./db');
  await dbModule.saveWorkspaceCampaign(updatedCampaign);

  await logEvent(
    {
      campaignId: campaign.id,
      actionType: 'comment_added',
      user,
      timestamp: commentObj.timestamp,
      details: {
        commentId: commentObj.id,
        comment: commentObj.comment
      }
    },
    options
  );

  return {
    success: true,
    comment: commentObj,
    campaign: updatedCampaign
  };
}

/**
 * Generates an exportable review record packet including all metadata,
 * compliance findings, OCR data, sign-offs, and chronological audit events.
 */
function generateReviewExport(campaign, user, events = []) {
  const findings = Array.isArray(campaign.initialFindings) ? campaign.initialFindings : [];
  const openCount = findings.filter((f) => f.status === 'open').length;
  const resolvedCount = findings.filter((f) => f.status !== 'open').length;

  return {
    exportVersion: '2.0',
    generatedAt: new Date().toISOString(),
    exportedBy: {
      id: user.id,
      username: user.username,
      role: user.role
    },
    campaign: {
      id: campaign.id,
      code: campaign.code,
      title: campaign.title,
      brandId: campaign.brandId,
      brandName: campaign.brandName,
      channel: campaign.channel,
      format: campaign.format,
      aspectRatio: campaign.aspectRatio,
      imageUrl: campaign.imageUrl,
      assetId: campaign.assetId,
      agency: campaign.agency || undefined,
      caption: campaign.caption,
      ocrText: campaign.ocrText,
      ocrConfidence: campaign.ocrConfidence,
      correctedArtworkText: campaign.correctedArtworkText || undefined,
      status: normalizeStatus(campaign.status),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt
    },
    workflowSignOff: {
      status: normalizeStatus(campaign.status),
      reviewer: campaign.reviewedBy
        ? {
            username: campaign.reviewedBy,
            role: campaign.reviewerRole,
            signedAt: campaign.reviewedAt,
            notes: campaign.reviewerNotes
          }
        : null,
      approver: campaign.approvedBy
        ? {
            username: campaign.approvedBy,
            role: campaign.approverRole,
            signedAt: campaign.approvedAt,
            criticalOverrideReason: campaign.criticalOverrideReason || null
          }
        : null,
      rejection: campaign.rejectedBy
        ? {
            username: campaign.rejectedBy,
            role: campaign.rejectedRole,
            rejectedAt: campaign.rejectedAt,
            reason: campaign.rejectionReason
          }
        : null
    },
    complianceSummary: {
      totalFindings: findings.length,
      openFindings: openCount,
      resolvedFindings: resolvedCount,
      complianceScore: campaign.complianceScore ?? (openCount === 0 ? 100 : Math.max(0, 100 - openCount * 25)),
      findings: findings.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        ruleTitle: f.ruleTitle,
        severity: f.severity,
        matchedText: f.matchedText,
        source: f.source,
        status: f.status,
        dismissNote: f.dismissNote,
        bbox: f.bbox
      }))
    },
    auditTrail: events.map((e) => ({
      id: e.id || e._id,
      timestamp: e.timestamp,
      actionType: e.actionType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      user: e.user,
      details: e.details
    }))
  };
}

module.exports = {
  WORKFLOW_STATUSES,
  VALID_TRANSITIONS,
  ROLE_PERMISSIONS,
  normalizeStatus,
  isSelfApproval,
  logEvent,
  getCampaignEvents,
  transitionWorkflow,
  addCampaignComment,
  generateReviewExport
};
