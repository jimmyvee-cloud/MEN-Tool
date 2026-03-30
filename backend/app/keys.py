"""DynamoDB key helpers — single-table layout."""


def pk_tenant(tenant_id: str) -> str:
    return f"TENANT#{tenant_id}"


def pk_user(tenant_id: str, user_id: str) -> str:
    return f"TENANT#{tenant_id}#USER#{user_id}"


def sk_user_profile() -> str:
    return "PROFILE"


def sk_stressor(logged_at_iso: str, stressor_id: str) -> str:
    return f"STRESSOR#{logged_at_iso}#{stressor_id}"


def sk_relief(logged_at_iso: str, relief_id: str) -> str:
    return f"RELIEF#{logged_at_iso}#{relief_id}"


def sk_checkin(logged_at_iso: str, checkin_id: str) -> str:
    return f"CHECKIN#{logged_at_iso}#{checkin_id}"


def sk_preset_global(preset_id: str) -> str:
    return f"PRESET#GLOBAL#{preset_id}"


def sk_preset_user(user_id: str, preset_id: str) -> str:
    return f"PRESET#USER#{user_id}#{preset_id}"


def sk_badge_def(badge_id: str) -> str:
    return f"BADGE_DEF#{badge_id}"


def sk_user_badge(badge_id: str) -> str:
    return f"BADGE#{badge_id}"


def sk_following(followed_user_id: str) -> str:
    return f"FOLLOWING#{followed_user_id}"


def sk_follower(follower_user_id: str) -> str:
    return f"FOLLOWER#{follower_user_id}"


def sk_block(blocked_user_id: str) -> str:
    return f"BLOCK#{blocked_user_id}"


def sk_wall(created_at_iso: str, post_id: str) -> str:
    return f"WALL#{created_at_iso}#{post_id}"


def sk_tenant_meta() -> str:
    return "META"


def gsi1_pk_email(tenant_id: str, email_lower: str) -> str:
    return f"TENANT#{tenant_id}#EMAIL#{email_lower}"


def gsi2_pk_invite(tenant_id: str, invite_code: str) -> str:
    return f"TENANT#{tenant_id}#INVITE#{invite_code}"


def gsi3_pk_tenant_users(tenant_id: str) -> str:
    return f"TENANT#{tenant_id}#USERS"


def gsi3_sk_user_created(created_at_iso: str, user_id: str) -> str:
    return f"CREATED#{created_at_iso}#{user_id}"


def gsi4_pk_followers(tenant_id: str, followed_user_id: str) -> str:
    return f"TENANT#{tenant_id}#USER#{followed_user_id}#FOLLOWERS"
