package mailer

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"strconv"

	"github.com/XiaoleC05/oxelia51-backend/internal/config"
)

type Mailer interface {
	Send(ctx context.Context, to, subject, body string) error
}

type SMTPMailer struct {
	cfg *config.Config
}

func New(cfg *config.Config) Mailer {
	if cfg.SMTPConfigured() {
		return &SMTPMailer{cfg: cfg}
	}
	return &ConsoleMailer{cfg: cfg}
}

func (m *SMTPMailer) Send(ctx context.Context, to, subject, body string) error {
	_ = ctx
	addr := m.cfg.SMTPHost + ":" + m.cfg.SMTPPort
	from := m.cfg.MailFrom
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, to, subject, body))

	port, _ := strconv.Atoi(m.cfg.SMTPPort)
	if m.cfg.SMTPTLS || port == 465 {
		return sendMailTLS(addr, m.cfg.SMTPUser, m.cfg.SMTPPass, from, []string{to}, msg)
	}
	auth := smtp.PlainAuth("", m.cfg.SMTPUser, m.cfg.SMTPPass, m.cfg.SMTPHost)
	return smtp.SendMail(addr, auth, from, []string{to}, msg)
}

func sendMailTLS(addr, user, pass, from string, to []string, msg []byte) error {
	host := addr
	if i := len(addr) - 1; i >= 0 {
		for j, c := range addr {
			if c == ':' {
				host = addr[:j]
				break
			}
		}
	}
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host})
	if err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer client.Close()

	if err = client.Auth(smtp.PlainAuth("", user, pass, host)); err != nil {
		return err
	}
	if err = client.Mail(from); err != nil {
		return err
	}
	for _, rcpt := range to {
		if err = client.Rcpt(rcpt); err != nil {
			return err
		}
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err = w.Write(msg); err != nil {
		return err
	}
	if err = w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

// ConsoleMailer logs emails when SMTP is not configured (local dev).
type ConsoleMailer struct {
	cfg *config.Config
}

func (m *ConsoleMailer) Send(ctx context.Context, to, subject, body string) error {
	_ = ctx
	log.Printf("[邮件-开发模式] To=%s Subject=%s\n%s", to, subject, body)
	return nil
}
