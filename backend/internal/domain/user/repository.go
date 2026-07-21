package user

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository 封装用户数据库查询
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) FetchByAccountID(ctx context.Context, accountID string) (User, error) {
	var u User
	err := r.db.QueryRow(ctx,
		`SELECT id, account_id, username, password, email, role, email_verified, created_at, updated_at
		 FROM users WHERE account_id = $1`, accountID,
	).Scan(&u.ID, &u.AccountID, &u.Username, &u.Password, &u.Email, &u.Role, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func (r *Repository) FetchByEmail(ctx context.Context, email string) (User, error) {
	var u User
	err := r.db.QueryRow(ctx,
		`SELECT id, account_id, username, password, email, role, email_verified, created_at, updated_at
		 FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.AccountID, &u.Username, &u.Password, &u.Email, &u.Role, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func (r *Repository) FetchByID(ctx context.Context, id string) (User, error) {
	var u User
	err := r.db.QueryRow(ctx,
		`SELECT id, account_id, username, password, email, role, email_verified, created_at, updated_at
		 FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.AccountID, &u.Username, &u.Password, &u.Email, &u.Role, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}
