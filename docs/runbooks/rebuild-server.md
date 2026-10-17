# Rebuild the server from scratch

**When:** the VPS is lost, compromised, or has to move to a new host.
**Result:** a fresh Ubuntu 24.04 server in the same hardened state as today, ready for Caddy (#12) and the deploy (#13).
**Last rehearsed:** not yet. The playbook was written against the live server, but a full rebuild on a throwaway
droplet has not been performed. Record the date here when it is.

## Before you start
- On your machine: `ansible-core` and the collections in `infra/ansible/requirements.yml`
  (`ansible-galaxy collection install -r infra/ansible/requirements.yml`).
- The deploy SSH key pair, unlocked in your agent.
- A password for the `deploy` user, chosen now and kept in your password manager. It is needed for `sudo`.

## 1. Create the server
1. DigitalOcean: create a droplet, Ubuntu 24.04 LTS, with your SSH key selected for authentication.
2. Note the new IP address.
3. If you have connected to that IP before, remove the old host key: `ssh-keygen -R <new-ip>`.

## 2. Bootstrap the deploy user (manual, once)
A fresh droplet only has `root`. The playbook runs as `deploy` and does not set passwords (a password hash in the repo
would be a secret), so create the user by hand first:

```bash
ssh root@<new-ip>
# Before answering "yes", compare the fingerprint with the droplet console's
#   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
adduser deploy                      # prompts for the password chosen above
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # same authorised key as root
exit
```

Check that `ssh deploy@<new-ip>` works and `sudo -v` accepts the password **before** continuing.

## 3. Run the playbook
From `infra/ansible/`:

```bash
export HUB_VPS_HOST=<new-ip>
export HUB_SSH_PUBLIC_KEY_FILE=~/.ssh/<deploy-key>.pub

ansible-playbook site.yml --check --diff -K   # dry run: expect changes everywhere on a fresh server
ansible-playbook site.yml --diff -K           # apply; keep a second SSH session open until it finishes
ansible-playbook site.yml --diff -K           # must end with changed=0
```

On a fresh server the dry run may fail at the Docker package task, because the Docker repository it depends on is only
added for real in the apply. That is expected; the apply does not have this problem.

## 4. Verify
```bash
ssh root@<new-ip>                     # must be refused: Permission denied (publickey)
ssh deploy@<new-ip> 'sudo sshd -T | grep -E "^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication) "'
ssh deploy@<new-ip> 'sudo ufw status verbose; sudo fail2ban-client status sshd'
ssh deploy@<new-ip> 'docker run --rm hello-world && docker compose version'
```

Expected: `permitrootlogin no`, `passwordauthentication no`, `kbdinteractiveauthentication no`,
`pubkeyauthentication yes`; ufw active with OpenSSH, 80/tcp and 443/tcp allowed; the sshd jail listed; Docker runs
without `sudo`.

## 5. What comes next (not covered here)
- Point DNS (`@` and `www`) at the new IP.
- Install and configure Caddy (#12).
- Deploy the application stack and restore data from backup (#13, #63).
