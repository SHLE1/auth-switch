use std::fs;
use std::io;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn atomic_write(target: &Path, content: &str) -> io::Result<()> {
    let dir = target.parent().expect("target has parent");
    fs::create_dir_all(dir)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
    }

    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let tmp = dir.join(format!(
        "{}.tmp.{}.{}",
        target.file_name().unwrap().to_string_lossy(),
        std::process::id(),
        millis
    ));
    let mut renamed = false;
    let result = (|| {
        fs::write(&tmp, content)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600))?;
        }
        #[cfg(windows)]
        if target.exists() {
            fs::remove_file(target)?;
        }
        fs::rename(&tmp, target)?;
        renamed = true;
        Ok(())
    })();

    if !renamed {
        let _ = fs::remove_file(&tmp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_writes_file() {
        let dir = std::env::temp_dir().join(format!("auth-switch-write-test-{}", std::process::id()));
        let target = dir.join("auth.json");
        atomic_write(&target, "{\"ok\":true}\n").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "{\"ok\":true}\n");
        assert!(fs::read_dir(&dir).unwrap().all(|entry| !entry.unwrap().file_name().to_string_lossy().contains(".tmp.")));
        let _ = fs::remove_dir_all(dir);
    }
}
